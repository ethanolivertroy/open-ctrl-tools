import * as React from 'react';
import {
  Menu as UiMenu,
  MenuTrigger as UiMenuTrigger,
  MenuContent as UiMenuContent,
  MenuItem as UiMenuItem,
  MenuSeparator as UiMenuSeparator,
  MenuGroup as UiMenuGroup,
  MenuGroupLabel as UiMenuGroupLabel,
  MenuSub as UiMenuSub,
  MenuSubTrigger as UiMenuSubTrigger,
  MenuSubContent as UiMenuSubContent,
  type MenuProps,
} from '@ui-sdk/react/menu';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function DropdownMenu(props: MenuProps) {
  return <UiMenu {...props} />;
}

const DropdownMenuTrigger = UiMenuTrigger;
const DropdownMenuGroup = UiMenuGroup;
const DropdownMenuGroupLabel = UiMenuGroupLabel;
const DropdownMenuSub = UiMenuSub;

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiMenuContent>) {
  return (
    <UiMenuContent
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-foreground shadow-xl transition-all data-[ending]:opacity-0 data-[starting]:opacity-0 data-[starting]:scale-95',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof UiMenuSubTrigger>, 'children'> & {
  children?: React.ReactNode;
  inset?: boolean;
}) {
  return (
    <UiMenuSubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={cn(
        'flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </UiMenuSubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiMenuSubContent>) {
  return (
    <UiMenuSubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-foreground shadow-xl transition-all data-[ending]:opacity-0 data-[starting]:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiMenuItem> & { inset?: boolean }) {
  return (
    <UiMenuItem
      data-slot="dropdown-menu-item"
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        'px-2 py-1.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiMenuSeparator>) {
  return (
    <UiMenuSeparator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
