import * as React from 'react';
import {
  Dialog as UiDialog,
  DialogBackdrop as UiDialogBackdrop,
  DialogClose as UiDialogClose,
  DialogContent as UiDialogContent,
  DialogDescription as UiDialogDescription,
  DialogTitle as UiDialogTitle,
  DialogTrigger as UiDialogTrigger,
} from '@ui-sdk/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = UiDialog;
const DialogTrigger = UiDialogTrigger;
const DialogClose = UiDialogClose;

function DialogOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiDialogBackdrop>) {
  return (
    <UiDialogBackdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity data-[ending]:opacity-0 data-[starting]:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof UiDialogContent>, 'children'> & {
  children?: React.ReactNode;
  showCloseButton?: boolean;
}) {
  return (
    <>
      <DialogOverlay />
      <UiDialogContent
        data-slot="dialog-content"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-background p-6 shadow-2xl transition-all data-[ending]:opacity-0 data-[starting]:opacity-0 data-[starting]:scale-95',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <UiDialogClose
            aria-label="Close"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </UiDialogClose>
        )}
      </UiDialogContent>
    </>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiDialogTitle>) {
  return (
    <UiDialogTitle
      data-slot="dialog-title"
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiDialogDescription>) {
  return (
    <UiDialogDescription
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
