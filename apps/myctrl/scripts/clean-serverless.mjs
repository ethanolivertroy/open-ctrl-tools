/**
 * Post-build cleanup: remove client-only packages from the Vercel serverless
 * function bundle to stay under the 250 MB unzipped size limit.
 *
 * These packages are only used in React client:load / client:only islands
 * and are never invoked by the server entry (API routes).
 */
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const FUNC_DIR = '.vercel/output/functions/_render.func/node_modules';

// Client-only packages that should never be in the serverless bundle
const REMOVE = [
  // --- ML / AI runtimes (141+ MB) ---
  'onnxruntime-node',       // 141 MB — native ML runtime (Transformers.js dep)
  'onnxruntime-common',     // companion to onnxruntime-node
  'onnxruntime-web',        // browser ONNX runtime
  '@mlc-ai',                // 6 MB — browser-only WebLLM
  '@huggingface',           // 5 MB — browser-only ML inference
  '@browser-ai',            // browser AI wrapper packages
  '@mediapipe',             // 33 MB — computer vision (client-only)

  // --- Next.js / transitive from @vercel/analytics & geist ---
  'next',                   // 170+ MB — pulled in transitively, not used by Astro
  '@next',                  // Next.js internals

  // --- Icons & UI (44+ MB) ---
  'lucide-react',           // 44 MB — icon library (client-only)
  'geist',                  // 7.9 MB — UI font/components (client-only)

  // --- 3D graphics (65+ MB) ---
  'three',                  // 4 MB — 3D graphics (client-only)
  'three-stdlib',           // 29 MB — 3D utilities (transitive from drei)
  '@react-three',           // react-three/fiber + drei (client-only)
  'stats-gl',               // 29 MB — 3D stats monitor (client-only)

  // --- Media ---
  'hls.js',                 // 24 MB — video streaming (client-only)
  '@shikijs',               // 12 MB — syntax highlighting

  // --- Image processing ---
  '@img',                   // 16 MB — sharp native binaries
  'sharp',                  // image processing (Vercel handles images at edge)

  // --- Drawing / canvas ---
  'tldraw',                 // drawing canvas (client-only)
  '@tldraw',                // tldraw internals
  'pixi.js',               // 2D rendering engine (client-only)
  '@pixi',                  // pixi.js internals

  // --- Code editor ---
  'monaco-editor',          // code editor (client-only)
  '@monaco-editor',         // monaco React wrapper

  // --- Visualization ---
  'react-force-graph-2d',   // force graph (client-only)
  'd3-force',               // pulled in by force graph

  // --- Browser-only storage ---
  'dexie',                  // IndexedDB wrapper (browser-only)
];

if (!existsSync(FUNC_DIR)) {
  console.log('⏭  No function bundle found — skipping cleanup');
  process.exit(0);
}

let totalRemoved = 0;

for (const pkg of REMOVE) {
  const pkgPath = join(FUNC_DIR, pkg);
  if (existsSync(pkgPath)) {
    await rm(pkgPath, { recursive: true, force: true });
    totalRemoved++;
    console.log(`  ✓ removed ${pkg}`);
  }
}

console.log(`\n🧹 Cleaned ${totalRemoved} client-only packages from serverless bundle`);
