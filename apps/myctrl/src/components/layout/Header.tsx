import * as React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getFavorites } from '@/lib/storage/favorites-store';
import { getRecentlyViewed } from '@/lib/storage/recently-viewed-store';
import { useEdgeSwipe } from '@/hooks/useEdgeSwipe';
import { requestOpenAIChat } from '@/lib/ai-chat-events';
import { FRAMEWORK_CONFIGS } from '@/data/framework-configs';
import { Mic } from 'lucide-react';

interface HeaderProps {
  frameworkId?: string;
  lastUpdated?: string;
}

// Popular loaded frameworks for quick access
const POPULAR_FRAMEWORKS = [
  { id: 'nist-800-53-r5', label: 'NIST 800-53', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'fedramp-rev5', label: 'FedRAMP Rev 5', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  { id: 'fedramp-20x-ksi', label: 'FedRAMP 20x', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { id: 'nist-csf-v2', label: 'NIST CSF 2.0', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'cmmc-v2', label: 'CMMC v2', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { id: 'owasp-web-top10', label: 'OWASP Top 10', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'owasp-llm-top10', label: 'OWASP LLM', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { id: 'eu-ai-act', label: 'EU AI Act', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
];

// Framework display name, from the canonical config registry
function frameworkLabel(id: string): string {
  return FRAMEWORK_CONFIGS[id]?.name ?? id;
}

type NavLink = {
  href: string;
  label: string;
  featured?: boolean;
};

const COMPARE_LINKS: NavLink[] = [
  { href: '/compare', label: 'Compare Frameworks' },
  { href: '/compare/controls', label: 'Compare Controls' },
];

const CORE_TOOL_LINKS: NavLink[] = [
  { href: '/assess', label: 'Assessment Workbench', featured: true },
  { href: '/crosswalk/visualize', label: 'Crosswalk Workbench' },
  { href: '/crosswalk', label: 'Crosswalk Index' },
  { href: '/cmvp', label: 'CMVP Explorer' },
];

const REFERENCE_TOOL_LINKS: NavLink[] = [
  { href: '/guidance', label: 'Technology Guidance' },
  { href: '/search', label: 'Full Search' },
];

// Mobile menu: flattened, uniform lists
const MOBILE_BROWSE_LINKS: NavLink[] = [
  { href: '/all', label: 'All Frameworks' },
  { href: '/guidance', label: 'Technology Guidance' },
];

const MOBILE_CATEGORY_LINKS: NavLink[] = [
  { href: '/us-federal', label: 'Federal' },
  { href: '/ai', label: 'AI' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/international', label: 'International' },
  { href: '/owasp', label: 'OWASP' },
];

const MOBILE_TOOL_LINKS: NavLink[] = [
  { href: '/assess', label: 'Assessment Workbench', featured: true },
  { href: '/compare', label: 'Compare Frameworks' },
  { href: '/compare/controls', label: 'Compare Controls' },
  { href: '/crosswalk/visualize', label: 'Crosswalk Workbench' },
  { href: '/crosswalk', label: 'Crosswalk Index' },
  { href: '/cmvp', label: 'CMVP Explorer' },
  { href: '/search', label: 'Full Search' },
];

const MOBILE_ABOUT_LINKS: NavLink[] = [
  { href: '/about', label: 'About myctrl.tools' },
  { href: '/about/user-data', label: 'User Data & Privacy' },
];

const DEVELOPER_LINKS: NavLink[] = [
  { href: '/developers', label: 'Developer Hub' },
  { href: '/developers/api', label: 'API Reference' },
  { href: '/guidance/nist-cmvp-api', label: 'Upstream CMVP API' },
  { href: '/llms.txt', label: 'llms.txt' },
];

export default function Header({ frameworkId }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  useEdgeSwipe({ onSwipe: () => { if (!mobileMenuOpen) setMobileMenuOpen(true); } });
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = React.useState<Awaited<ReturnType<typeof getRecentlyViewed>>>([]);

  // Load local browser data on mount.
  React.useEffect(() => {
    Promise.all([getFavorites(), getRecentlyViewed()]).then(([favs, recent]) => {
      setFavorites(favs);
      setRecentlyViewed(recent);
    });
  }, [mobileMenuOpen]); // Refresh when menu opens

  const [headerQuery, setHeaderQuery] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = headerQuery.trim();
    window.location.href = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search';
  };

  const handleSearchClick = () => {
    window.location.href = '/search';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4 sm:px-6">
        {/* Mobile menu button */}
        <Sheet
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
        >
          <SheetTrigger
            className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'lg:hidden mr-1 sm:mr-2' })}
          >
            <MenuIcon className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-80 p-0 bg-background/80 backdrop-blur-xl border-r-border/30 flex flex-col" style={{ WebkitBackdropFilter: 'blur(24px)' }}>
            <SheetHeader className="px-6 py-4 border-b border-dashed border-border/40 shrink-0">
              <SheetTitle className="flex items-center gap-2">
                <span className="font-semibold tracking-tight">
                  myctrl<span className="text-primary">.tools</span>
                </span>
                <a href="https://www.hackidle.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground font-normal tracking-normal hover:text-foreground transition-colors">by hackIDLE</a>
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Search — first, it's the primary action */}
              <div className="px-4 pt-4 pb-2">
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2 text-muted-foreground justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    document.dispatchEvent(new CustomEvent('open-search'));
                  }}
                >
                  <SearchIcon className="h-4 w-4" />
                  <span className="flex-1 text-left">Search controls...</span>
                </Button>
              </div>

              {/* Browse */}
              <div className="px-4 py-4">
                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Browse
                </div>
                <div className="space-y-0.5">
                  {MOBILE_BROWSE_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-muted/60 transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                  {MOBILE_CATEGORY_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-2.5 py-1 text-xs rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Favorites */}
              {favorites.length > 0 && (
                <div className="px-4 py-4 border-t border-dashed border-border/40">
                  <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Favorites
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3">
                    {favorites.slice(0, 6).map((id) => (
                      <a
                        key={id}
                        href={`/frameworks/${id}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-1 text-xs rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        {frameworkLabel(id)}
                      </a>
                    ))}
                    {favorites.length > 6 && (
                      <a
                        href="/preferences#favorites"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-1 text-xs rounded-md text-muted-foreground/70 hover:text-foreground transition-colors"
                      >
                        +{favorites.length - 6} more
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Recently viewed */}
              {recentlyViewed.length > 0 && (
                <div className="px-4 py-4 border-t border-dashed border-border/40">
                  <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Recently Viewed
                  </div>
                  <div className="space-y-0.5">
                    {recentlyViewed.slice(0, 5).map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-muted/60 transition-colors truncate"
                      >
                        {item.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular frameworks */}
              <div className="px-4 py-4 border-t border-dashed border-border/40">
                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Popular Frameworks
                </div>
                <div className="flex flex-wrap gap-1.5 px-3">
                  {POPULAR_FRAMEWORKS.map((fw) => (
                    <a
                      key={fw.id}
                      href={`/frameworks/${fw.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-2.5 py-1 text-xs rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                    >
                      {fw.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="px-4 py-4 border-t border-dashed border-border/40">
                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Tools
                </div>
                <div className="space-y-0.5">
                  {MOBILE_TOOL_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                        link.featured
                          ? 'bg-primary/10 font-medium text-foreground hover:bg-primary/20'
                          : 'text-foreground/90 hover:bg-muted/60'
                      }`}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Developers */}
              <div className="px-4 py-4 border-t border-dashed border-border/40">
                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Developers
                </div>
                <div className="space-y-0.5">
                  {DEVELOPER_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-muted/60 transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* About + Preferences */}
              <div className="px-4 py-4 border-t border-dashed border-border/40">
                <div className="space-y-0.5">
                  {MOBILE_ABOUT_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-muted/60 transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                  <a
                    href="/preferences"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-muted/60 transition-colors"
                  >
                    <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                    Preferences
                  </a>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <div className="flex items-center mr-4 sm:mr-6">
          <a href="/" className="font-semibold text-lg tracking-tight">
            myctrl<span className="text-primary">.tools</span>
          </a>
          <a href="https://www.hackidle.com/" target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-muted-foreground font-normal tracking-normal hover:text-foreground transition-colors">by hackIDLE</a>
        </div>

        {/* Desktop Navigation Dropdowns - hidden on mobile */}
        <nav className="hidden lg:flex items-center gap-1 ml-4">
          {/* Frameworks Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'gap-1' })}>
              Frameworks
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Browse by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href="/us-federal" className="cursor-pointer" />}>
                US Federal
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href="/ai" className="cursor-pointer" />}>
                AI
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href="/privacy" className="cursor-pointer" />}>
                Privacy
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href="/international" className="cursor-pointer" />}>
                International
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href="/all" className="cursor-pointer" />}>
                All Frameworks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tools Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'gap-1 text-muted-foreground hover:text-foreground' })}>
              Tools
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[14rem]">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Compare</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {COMPARE_LINKS.map((link) => (
                    <DropdownMenuItem key={link.href} render={<a href={link.href} className="cursor-pointer" />}>
                      {link.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Core Tools</DropdownMenuLabel>
              {CORE_TOOL_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} render={<a href={link.href} className="cursor-pointer" />}>
                  {link.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Reference</DropdownMenuLabel>
              {REFERENCE_TOOL_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} render={<a href={link.href} className="cursor-pointer" />}>
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Developers Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'gap-1 text-muted-foreground hover:text-foreground' })}>
              Developers
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[14rem]">
              <DropdownMenuLabel>Developer Resources</DropdownMenuLabel>
              {DEVELOPER_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} render={<a href={link.href} className="cursor-pointer" />}>
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Copilot Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'gap-1 text-muted-foreground hover:text-foreground' })}>
              GRCLanker
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => requestOpenAIChat({ tab: 'chat' })}>
                Open Chat Copilot (⌘J)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => requestOpenAIChat({ tab: 'voice', voiceMode: 'copilot' })}>
                Voice Copilot (⌘⇧V)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => requestOpenAIChat({ tab: 'voice', voiceMode: 'audit-interview' })}>
                Mock Audit Interview
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* About Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', className: 'gap-1 text-muted-foreground hover:text-foreground' })}>
              About
              <ChevronDownIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem render={<a href="/about" className="cursor-pointer" />}>
                About myctrl.tools
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href="/about/user-data" className="cursor-pointer" />}>
                User Data &amp; Privacy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search input */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden sm:flex items-center gap-2 text-muted-foreground w-64 h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          <SearchIcon className="h-4 w-4 flex-shrink-0" />
          <input
            type="text"
            value={headerQuery}
            onChange={(e) => setHeaderQuery(e.target.value)}
            placeholder="Search controls..."
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
            aria-label="Search controls"
          />
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[11px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </form>

        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={handleSearchClick}
        >
          <SearchIcon className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>

        {/* Quick Voice Copilot button */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 sm:ml-2 text-muted-foreground hover:text-primary"
          onClick={() => requestOpenAIChat({ tab: 'voice', voiceMode: 'copilot' })}
          title="Voice Copilot (⌘⇧V)"
          aria-label="Open Voice Copilot"
        >
          <Mic className="h-4 w-4" />
        </Button>

        {/* Preferences link */}
        <a
          href="/preferences"
          className="ml-2 sm:ml-4 text-muted-foreground hover:text-primary transition-colors"
          title="Preferences"
        >
          <SettingsIcon className="h-5 w-5" />
          <span className="sr-only">Preferences</span>
        </a>
      </div>
    </header>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
