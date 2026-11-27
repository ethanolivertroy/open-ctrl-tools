import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { CommandBlock } from '../ui/CommandBlock';
import type { KSIProgrammaticQuery, KSITool, KSIToolCategory } from '../../data/types';

interface KSIProgrammaticQueriesProps {
  queries: KSIProgrammaticQuery;
}

// ── Tool Icons ──────────────────────────────────────────────────────────────

const AwsIcon = () => (
  <svg className="w-5 h-4" viewBox="0 115 304 75" fill="currentColor">
    <path d="M273.5,143.7c-32.9,24.3-80.7,37.2-121.8,37.2c-57.6,0-109.5-21.3-148.7-56.7c-3.1-2.8-0.3-6.6,3.4-4.4c42.4,24.6,94.7,39.5,148.8,39.5c36.5,0,76.6-7.6,113.5-23.2C274.2,133.6,278.9,139.7,273.5,143.7z"/>
    <path d="M287.2,128.1c-4.2-5.4-27.8-2.6-38.5-1.3c-3.2,0.4-3.7-2.4-0.8-4.5c18.8-13.2,49.7-9.4,53.3-5c3.6,4.5-1,35.4-18.6,50.2c-2.7,2.3-5.3,1.1-4.1-1.9C282.5,155.7,291.4,133.4,287.2,128.1z"/>
  </svg>
);

const AzureIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd">
    <path d="M19.867 7.282l-4.733 9.533 8.333 9.66L8 28.23l24 .25z"/>
    <path d="M18.933 3.52L8.067 12.613 0 26.223l6.867-.7z"/>
  </svg>
);

const GcpIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const OktaIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z"/>
  </svg>
);

const TerraformIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M1.5 0v8.2l7.1 4.1V4.1L1.5 0zm8.3 4.8v8.2l7.1 4.1V8.9l-7.1-4.1zm7.1-1.2L9.8 0v8.2l7.1 4.1V3.6zM9.8 13.9v8.2l7.1 4.1v-8.2l-7.1-4.1z"/>
  </svg>
);

const KubectlIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.204 14.35l.007.01-.999 2.413a5.171 5.171 0 0 1-2.075-2.597l2.578-.437.004.005a.44.44 0 0 1 .484.606zm-.833-2.129a.44.44 0 0 0 .173-.756l.002-.011L7.585 9.7a5.143 5.143 0 0 0-.73 3.255l2.514-.725.002-.009zm1.145-1.98a.44.44 0 0 0 .699-.337l.01-.005.15-2.62a5.144 5.144 0 0 0-3.01 1.442l2.147 1.523.004-.002zm.76 2.75l.795.073.012-.01 1.869 1.837a5.177 5.177 0 0 0 .032-3.334l-2.645.873-.008.005a.44.44 0 0 0-.054.556zm-.028-3.636l.005-.003.166-2.623a5.13 5.13 0 0 1 2.881 1.563l-1.93 1.638-.01-.002a.44.44 0 0 1-.784-.258l-.002-.003.674-.312zm2.709 5.29l2.015.46a5.186 5.186 0 0 1-2.024 2.467l-.972-2.385.004-.005a.44.44 0 0 1 .977-.537zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 17.611c-3.1 0-5.612-2.511-5.612-5.611S8.899 6.389 12 6.389s5.612 2.511 5.612 5.611-2.511 5.611-5.612 5.611z"/>
  </svg>
);

const VaultIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L0 21.818h24L12 0zm0 5.091l8.727 15.273H3.273L12 5.091z"/>
  </svg>
);

const SnykIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm4.62 13.308v3.168L12 19.26l-4.62-2.784v-3.168l4.62 2.784 4.62-2.784zm0-5.544v3.168L12 13.716l-4.62-2.784V7.764L12 10.548l4.62-2.784z"/>
  </svg>
);

const SplunkIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1 17H8v-3h3v3zm0-5H8V9h3v3zm5 5h-3v-3h3v3zm0-5h-3V9h3v3z"/>
  </svg>
);

const JiraIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24.013 12.5V1.005A1.005 1.005 0 0 0 23.013 0z"/>
  </svg>
);

const DuoIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="8" cy="12" r="6"/>
    <circle cx="16" cy="12" r="6" opacity="0.6"/>
  </svg>
);

const DatadogIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.2 16.8c-.6.4-1.4.2-1.8-.4l-1-1.6-2.2 1.6c-.2.1-.4.2-.6.2-.4 0-.8-.2-1-.6l-2-3.6c-.3-.6-.1-1.4.5-1.7.6-.3 1.4-.1 1.7.5l1.2 2.2 2.2-1.6c.5-.4 1.3-.3 1.7.3l1.6 2.6c.5.5.3 1.3-.3 1.7z"/>
  </svg>
);

const PagerDutyIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.965 1.18C15.085.164 13.769 0 10.683 0H3.73v14.55h6.926c2.743 0 4.8-.164 6.61-1.37 1.975-1.303 3.004-3.47 3.004-6.14 0-2.943-1.33-4.826-3.305-5.86zM12.197 10.63c-.96.493-2.166.575-3.594.575H7.484V3.334h1.174c1.4 0 2.468.055 3.429.547.988.52 1.646 1.56 1.646 3.32 0 1.842-.72 2.89-1.536 3.43zM3.73 17.79h3.754V24H3.73v-6.21z"/>
  </svg>
);

const TerminalIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

// Map tool ID prefixes to icons (tool IDs are like "okta-aam", "aws-iam-mfa", etc.)
const TOOL_ICON_PREFIXES: [string, React.FC][] = [
  ['aws', AwsIcon],
  ['azure', AzureIcon],
  ['gcp', GcpIcon],
  ['gcloud', GcpIcon],
  ['gh', GitHubIcon],
  ['okta', OktaIcon],
  ['terraform', TerraformIcon],
  ['kubectl', KubectlIcon],
  ['vault', VaultIcon],
  ['snyk', SnykIcon],
  ['splunk', SplunkIcon],
  ['jira', JiraIcon],
  ['duo', DuoIcon],
  ['datadog', DatadogIcon],
  ['pagerduty', PagerDutyIcon],
  ['npm', TerminalIcon],
  ['curl', TerminalIcon],
  ['openssl', TerminalIcon],
  ['dns', TerminalIcon],
  ['cosign', TerminalIcon],
  ['argocd', TerminalIcon],
  ['lms', TerminalIcon],
];

function getToolIcon(toolId: string): React.FC {
  for (const [prefix, Icon] of TOOL_ICON_PREFIXES) {
    if (toolId.startsWith(prefix)) return Icon;
  }
  return TerminalIcon;
}

// Category badge colors
const CATEGORY_COLORS: Record<KSIToolCategory, string> = {
  cloud: 'bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30',
  identity: 'bg-violet-500/20 text-violet-700 dark:text-violet-400 border-violet-500/30',
  cicd: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  security: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
  infrastructure: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  grc: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
};

const CATEGORY_LABELS: Record<KSIToolCategory, string> = {
  cloud: 'Cloud',
  identity: 'Identity',
  cicd: 'CI/CD',
  security: 'Security',
  infrastructure: 'Infrastructure',
  grc: 'GRC',
};

const ExternalLinkIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
  </svg>
);

// ── Tool Tab Content ────────────────────────────────────────────────────────

function ToolTab({ tool }: { tool: KSITool }) {
  return (
    <div className="space-y-4">
      {/* Category badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[tool.category]}`}>
          {CATEGORY_LABELS[tool.category]}
        </Badge>
      </div>

      {/* CLI Commands */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">CLI Commands</h4>
        <div className="space-y-3">
          {tool.commands.map((cmd, i) => (
            <CommandBlock key={i} command={cmd.command} description={cmd.description} />
          ))}
        </div>
      </div>

      {/* Docs link */}
      {tool.docs && (
        <div className="pt-2">
          <a
            href={tool.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {tool.name} Documentation
            <ExternalLinkIcon />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function KSIProgrammaticQueries({ queries }: KSIProgrammaticQueriesProps) {
  const { tools } = queries;

  if (tools.length === 0) return null;

  const defaultTab = tools[0].id;

  // For the tab grid, cap at 5 columns, then wrap
  const colCount = Math.min(tools.length, 5);
  const gridColsClass: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  };
  const colsClass = gridColsClass[colCount] || 'grid-cols-5';

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-primary">{'>'}</span>
            Programmatic Queries
          </h3>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className={`grid w-full ${colsClass} max-w-xl`}>
            {tools.map((tool) => {
              const Icon = getToolIcon(tool.id);
              return (
                <TabsTrigger key={tool.id} value={tool.id} className="flex items-center gap-2">
                  <Icon />
                  <span className="hidden sm:inline">{tool.name}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tools.map((tool) => (
            <TabsContent key={tool.id} value={tool.id}>
              <ToolTab tool={tool} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}
