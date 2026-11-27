/**
 * ProviderVault Component
 *
 * Settings panel listing all supported AI providers.
 * Replaces the single-provider APIKeyDialog for the settings gear icon.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ProviderCatalogList } from './ProviderCatalogList';

interface ProviderVaultProps {
  isOpen: boolean;
  onClose: () => void;
  onProvidersChanged?: () => void;
}

export function ProviderVault({
  isOpen,
  onClose,
  onProvidersChanged,
}: ProviderVaultProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>AI Providers</SheetTitle>
          <SheetDescription>
            Configure one or more AI providers. Your keys are stored locally.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <ProviderCatalogList
            autoLoad={isOpen}
            onProvidersChanged={onProvidersChanged}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ProviderVault;
