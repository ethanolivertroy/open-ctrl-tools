import * as React from 'react';
import {
  Command as UiCommand,
  CommandEmpty as UiCommandEmpty,
  CommandGroup as UiCommandGroup,
  CommandGroupLabel as UiCommandGroupLabel,
  CommandInput as UiCommandInput,
  CommandItem as UiCommandItem,
  CommandList as UiCommandList,
  CommandSeparator as UiCommandSeparator,
  type CommandProps as UiCommandProps,
} from '@ui-sdk/react/command';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CommandBridgeContextValue {
  controlledQuery?: string;
  onControlledQueryChange?: (value: string) => void;
  setControlledQuery: (value: string | undefined) => void;
  setControlledHandler: (handler: ((value: string) => void) | undefined) => void;
}

const CommandBridgeContext = React.createContext<CommandBridgeContextValue | null>(null);

export interface CommandProps extends UiCommandProps {
  className?: string;
}

function Command({ className, query, onQueryChange, filter = false, ...props }: CommandProps) {
  const [controlledQuery, setControlledQuery] = React.useState<string | undefined>(undefined);
  const handlerRef = React.useRef<((value: string) => void) | undefined>(undefined);

  const setControlledHandler = React.useCallback((handler: ((value: string) => void) | undefined) => {
    handlerRef.current = handler;
  }, []);

  const contextValue = React.useMemo<CommandBridgeContextValue>(
    () => ({
      controlledQuery,
      setControlledQuery,
      setControlledHandler,
    }),
    [controlledQuery, setControlledHandler],
  );

  return (
    <CommandBridgeContext.Provider value={contextValue}>
      <UiCommand
        data-slot="command"
        filter={filter}
        query={query !== undefined ? query : controlledQuery}
        onQueryChange={(nextQuery, details) => {
          onQueryChange?.(nextQuery, details);
          handlerRef.current?.(nextQuery);
        }}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-md bg-card text-foreground',
          className,
        )}
        {...props}
      />
    </CommandBridgeContext.Provider>
  );
}

interface CommandDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  title?: string;
  description?: string;
  filter?: UiCommandProps['filter'];
}

function CommandDialog({
  open,
  onOpenChange,
  children,
  title = 'Command Palette',
  description = 'Search controls, frameworks, or run a command.',
  filter = false,
}: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 shadow-2xl max-w-2xl bg-card border-border"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command
          filter={filter}
          className="[&_[data-slot=command-group-label]]:px-2 [&_[data-slot=command-group-label]]:font-medium [&_[data-slot=command-group-label]]:text-muted-foreground [&_[data-slot=command-input-wrapper]_svg]:h-5 [&_[data-slot=command-input-wrapper]_svg]:w-5 [&_[data-slot=command-input]]:h-12 [&_[data-slot=command-item]]:px-2 [&_[data-slot=command-item]]:py-3 [&_[data-slot=command-item]_svg]:h-5 [&_[data-slot=command-item]_svg]:w-5"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

interface CommandInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof UiCommandInput>, 'value' | 'onChange'> {
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

function CommandInput({ className, value, onValueChange, onChange, ...props }: CommandInputProps) {
  const bridge = React.useContext(CommandBridgeContext);

  React.useEffect(() => {
    if (!bridge) return;
    bridge.setControlledQuery(value);
  }, [bridge, value]);

  React.useEffect(() => {
    if (!bridge) return;
    bridge.setControlledHandler(onValueChange);
    return () => bridge.setControlledHandler(undefined);
  }, [bridge, onValueChange]);

  return (
    <div className="flex items-center border-b border-border px-3" data-slot="command-input-wrapper">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <UiCommandInput
        data-slot="command-input"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange?.(e);
          onValueChange?.(e.currentTarget.value);
        }}
        className={cn(
          'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiCommandList>) {
  return (
    <UiCommandList
      data-slot="command-list"
      className={cn('max-h-[420px] overflow-y-auto overflow-x-hidden', className)}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiCommandEmpty>) {
  return (
    <UiCommandEmpty
      data-slot="command-empty"
      className={cn('py-6 text-center text-sm', className)}
      {...props}
    />
  );
}

interface CommandGroupProps
  extends Omit<React.ComponentPropsWithoutRef<typeof UiCommandGroup>, 'children'> {
  heading?: React.ReactNode;
  children?: React.ReactNode;
}

function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  return (
    <UiCommandGroup
      data-slot="command-group"
      className={cn('overflow-hidden p-1 text-foreground', className)}
      {...props}
    >
      {heading && (
        <UiCommandGroupLabel
          data-slot="command-group-label"
          className="px-2 py-1.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          {heading}
        </UiCommandGroupLabel>
      )}
      {children}
    </UiCommandGroup>
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiCommandSeparator>) {
  return (
    <UiCommandSeparator
      data-slot="command-separator"
      className={cn('-mx-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiCommandItem>) {
  return (
    <UiCommandItem
      data-slot="command-item"
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent/50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
};
