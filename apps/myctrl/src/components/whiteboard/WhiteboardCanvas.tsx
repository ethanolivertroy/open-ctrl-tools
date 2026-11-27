import { useEffect, useRef, useCallback } from 'react';
import { Tldraw, type Editor, type TLStoreSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import {
  deleteWhiteboardSnapshot,
  getWhiteboardSnapshot,
  saveWhiteboardSnapshot,
} from '@/lib/storage/whiteboard-store';

interface WhiteboardCanvasProps {
  boardId: string;
  onTitleChange?: (title: string) => void;
}

export function WhiteboardCanvas({ boardId, onTitleChange }: WhiteboardCanvasProps) {
  const tldrawLicenseKey = import.meta.env.PUBLIC_TLDRAW_LICENSE_KEY?.trim();
  const isMissingProdLicense = import.meta.env.PROD && !tldrawLicenseKey;

  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const boardIdRef = useRef(boardId);

  // Keep boardId ref in sync
  boardIdRef.current = boardId;

  const saveSnapshot = useCallback(async (editor: Editor) => {
    try {
      // Persist document state only; session/UI state is ephemeral and can become incompatible.
      const snapshot = editor.store.getStoreSnapshot('document');
      await saveWhiteboardSnapshot(boardIdRef.current, snapshot);
    } catch (e) {
      console.error('Failed to save whiteboard:', e);
    }
  }, []);

  const toStoreSnapshot = useCallback((value: unknown, editor: Editor): TLStoreSnapshot | null => {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Record<string, unknown>;

    // Modern TLStoreSnapshot shape.
    if (candidate.store && candidate.schema) {
      return candidate as unknown as TLStoreSnapshot;
    }

    // Legacy editor snapshot shape: { document: TLStoreSnapshot, session: ... }.
    if (candidate.document && typeof candidate.document === 'object') {
      const doc = candidate.document as Record<string, unknown>;
      if (doc.store && doc.schema) {
        return doc as unknown as TLStoreSnapshot;
      }
    }

    // Legacy serialized records object (no schema wrapper).
    const keys = Object.keys(candidate);
    if (keys.length > 0) {
      const first = candidate[keys[0]];
      if (first && typeof first === 'object' && 'typeName' in (first as Record<string, unknown>)) {
        return {
          store: candidate as TLStoreSnapshot['store'],
          schema: editor.store.schema.serialize(),
        } as TLStoreSnapshot;
      }
    }

    return null;
  }, []);

  const debouncedSave = useCallback((editor: Editor) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSnapshot(editor);
    }, 1000);
  }, [saveSnapshot]);

  // onMount must be synchronous — tldraw expects void | cleanup function.
  // Returning a Promise (from async) causes "TypeError: p is not a function"
  // because tldraw pushes the return value into an unsubs array and calls it.
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set dark mode via editor API
    const theme = document.documentElement.dataset.theme || '';
    const isDark = theme !== 'latte';
    editor.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });

    // Load existing snapshot (fire-and-forget — no await)
    void (async () => {
      try {
        const snapshot = await getWhiteboardSnapshot(boardId);
        if (!snapshot) return;

        const normalized = toStoreSnapshot(snapshot, editor);
        if (!normalized) {
          console.warn('Discarding incompatible whiteboard snapshot');
          await deleteWhiteboardSnapshot(boardId);
          return;
        }

        try {
          editor.loadSnapshot(normalized);
          if (snapshot !== normalized) {
            await saveWhiteboardSnapshot(boardId, normalized);
          }
        } catch (loadError) {
          console.error('Failed to load whiteboard snapshot, resetting board:', loadError);
          await deleteWhiteboardSnapshot(boardId);
        }
      } catch (e) {
        console.error('Failed to load whiteboard:', e);
      }
    })();

    // Listen for changes and auto-save with debounce
    unsubscribeRef.current = editor.store.listen(() => {
      debouncedSave(editor);
    }, { scope: 'document' });
  }, [boardId, debouncedSave, toStoreSnapshot]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (editorRef.current) {
        saveSnapshot(editorRef.current);
      }
    };
  }, [saveSnapshot]);

  if (isMissingProdLicense) {
    return (
      <div className="w-full h-[calc(100vh-10rem)] bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="text-lg font-semibold text-amber-200">Whiteboard requires a tldraw production license</h2>
          <p className="mt-2 text-sm text-amber-100/90">
            The editor is disabled in production when no license key is configured.
            Set <code className="px-1 py-0.5 rounded bg-black/30">PUBLIC_TLDRAW_LICENSE_KEY</code> in Vercel
            environment variables and redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-10rem)]">
      <Tldraw
        onMount={handleMount}
        licenseKey={tldrawLicenseKey || undefined}
        options={{ maxPages: 1 }}
      />
    </div>
  );
}
