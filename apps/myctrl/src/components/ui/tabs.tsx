import * as React from 'react';
import {
  Tabs as UiTabs,
  TabsList as UiTabsList,
  TabsTab as UiTabsTab,
  TabsPanel as UiTabsPanel,
  TabsIndicator as UiTabsIndicator,
} from '@ui-sdk/react/tabs';
import { cn } from '@/lib/utils';

type UiTabsProps = React.ComponentPropsWithoutRef<typeof UiTabs>;

interface TabsProps extends Omit<UiTabsProps, 'onValueChange'> {
  onValueChange?: (value: string) => void;
}

function Tabs({ onValueChange, ...props }: TabsProps) {
  return (
    <UiTabs
      data-slot="tabs"
      onValueChange={onValueChange ? (value) => onValueChange(String(value)) : undefined}
      {...props}
    />
  );
}

function TabsList({
  className,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof UiTabsList>, 'children'> & {
  children?: React.ReactNode;
}) {
  return (
    <UiTabsList
      data-slot="tabs-list"
      className={cn(
        'relative inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <UiTabsIndicator className="pointer-events-none rounded-sm bg-background shadow-sm transition-all duration-200" />
      {children}
    </UiTabsList>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiTabsTab>) {
  return (
    <UiTabsTab
      data-slot="tabs-trigger"
      className={cn(
        'relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiTabsPanel>) {
  return (
    <UiTabsPanel
      data-slot="tabs-content"
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
