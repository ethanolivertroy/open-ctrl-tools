import * as React from 'react';
import {
  Drawer as UiDrawer,
  DrawerBackdrop as UiDrawerBackdrop,
  DrawerClose as UiDrawerClose,
  DrawerContent as UiDrawerContent,
  DrawerDescription as UiDrawerDescription,
  DrawerTitle as UiDrawerTitle,
  DrawerTrigger as UiDrawerTrigger,
  type DrawerProps,
} from '@ui-sdk/react/drawer';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SheetSide = 'top' | 'right' | 'bottom' | 'left';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

interface SheetContextValue {
  side: SheetSide;
  setSide: (side: SheetSide) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function Sheet({ side: sideProp, ...props }: Omit<DrawerProps, 'side'> & { side?: SheetSide }) {
  const [side, setSide] = React.useState<SheetSide>(sideProp ?? 'right');

  React.useEffect(() => {
    if (sideProp) {
      setSide(sideProp);
    }
  }, [sideProp]);

  const contextValue = React.useMemo(
    () => ({ side, setSide }),
    [side],
  );

  return (
    <SheetContext.Provider value={contextValue}>
      <UiDrawer side={side} {...props} />
    </SheetContext.Provider>
  );
}

const SheetTrigger = UiDrawerTrigger;
const SheetClose = UiDrawerClose;

function SheetPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiDrawerBackdrop>) {
  return (
    <UiDrawerBackdrop
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity data-[ending]:opacity-0 data-[starting]:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background p-6 shadow-2xl transition-transform duration-300 ease-out border-border',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[starting]:-translate-y-full data-[ending]:-translate-y-full',
        bottom:
          'inset-x-0 bottom-0 border-t data-[starting]:translate-y-full data-[ending]:translate-y-full',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[starting]:-translate-x-full data-[ending]:-translate-x-full',
        right:
          'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[starting]:translate-x-full data-[ending]:translate-x-full',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

export type SheetContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof UiDrawerContent>,
  'className' | 'children'
> &
  VariantProps<typeof sheetVariants> & {
    children?: React.ReactNode;
    className?: string;
    showCloseButton?: boolean;
  };

function SheetContent({
  side = 'right',
  className,
  children,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const ctx = React.useContext(SheetContext);
  const resolvedSide = side ?? ctx?.side ?? 'right';

  useIsomorphicLayoutEffect(() => {
    if (ctx && side && ctx.side !== side) {
      ctx.setSide(side);
    }
  }, [ctx, side]);

  return (
    <>
      <SheetOverlay />
      <UiDrawerContent
        data-slot="sheet-content"
        className={cn(sheetVariants({ side: resolvedSide }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <UiDrawerClose
            aria-label="Close"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </UiDrawerClose>
        )}
      </UiDrawerContent>
    </>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiDrawerTitle>) {
  return (
    <UiDrawerTitle
      data-slot="sheet-title"
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiDrawerDescription>) {
  return (
    <UiDrawerDescription
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
