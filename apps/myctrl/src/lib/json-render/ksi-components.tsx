import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommandBlock } from '@/components/ui/CommandBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getControlById } from '@/data/controls';
import { getKSIProgrammaticQueries } from '@/data/ksi-programmatic-queries';
import { getTrustCenterComponents as loadTrustCenterComponents } from '@/data/ksi-trust-center-components';
import { getKSIRequirements } from '@/data/fedramp-20x-requirements';
import type { FRMRRequirement } from '@/data/fedramp-20x-requirements';
import type { KSITool, KSIToolCategory } from '@/data/types';
import type { ComponentProps } from './primitives';

const CATEGORY_COLORS: Record<string, string> = {
  'documents-reports': 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  policies: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  'certifications-badges': 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  'architecture-diagrams': 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  dashboards: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  'product-security-features': 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  'evidence-artifacts': 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'questionnaire-responses': 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
  'vendor-supply-chain': 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  'processes-procedures': 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30',
};

const CATEGORY_NAMES: Record<string, string> = {
  'documents-reports': 'Documents & Reports',
  policies: 'Policies',
  'certifications-badges': 'Certifications & Badges',
  'architecture-diagrams': 'Architecture & Diagrams',
  dashboards: 'Dashboards',
  'product-security-features': 'Product Security Features',
  'evidence-artifacts': 'Evidence Artifacts',
  'questionnaire-responses': 'Questionnaire Responses',
  'vendor-supply-chain': 'Vendor & Supply Chain',
  'processes-procedures': 'Processes & Procedures',
};

export function AITrustCenterCard({ config }: ComponentProps<'TrustCenterCard'>) {
  const { name, category, description, examples } = config;

  const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS['documents-reports'];
  const categoryName = CATEGORY_NAMES[category] || category;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{name}</h4>
            <Badge variant="secondary" className={`text-xs ${colorClass}`}>
              {categoryName}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {examples && examples.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {examples.map((example, index) => (
              <span key={index} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {example}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AITrustCenterGrid({ config }: ComponentProps<'TrustCenterGrid'>) {
  const { ksiId, components: customComponents } = config;

  let components = customComponents;
  if (ksiId && !components) {
    components = loadTrustCenterComponents(ksiId);
  }

  if (!components || components.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No trust center components found{ksiId ? ` for ${ksiId}` : ''}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped: Record<string, typeof components> = {};
  for (const component of components) {
    const key = component.category;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(component);
  }

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {sortedGroups.map(([groupName, items]) => (
        <div key={groupName} className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">
            {CATEGORY_NAMES[groupName] || groupName}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((component, index) => (
              <AITrustCenterCard
                key={index}
                config={{
                  type: 'TrustCenterCard',
                  name: component.name,
                  category: component.category,
                  description: component.description,
                  examples: component.examples,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AITrustCenterChecklist({ config }: ComponentProps<'TrustCenterChecklist'>) {
  const { title, items } = config;
  const [checkedItems, setCheckedItems] = React.useState<Set<number>>(() => {
    const initial = new Set<number>();
    items.forEach((item, index) => {
      if (item.status === 'complete') initial.add(index);
    });
    return initial;
  });

  const toggleItem = (index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const completedCount = checkedItems.size;
  const totalCount = items.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {completedCount}/{totalCount} ({percentage}%)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="space-y-2">
          {items.map((item, index) => {
            const isChecked = checkedItems.has(index);
            const colorClass = CATEGORY_COLORS[item.category] || '';
            const categoryName = CATEGORY_NAMES[item.category] || item.category;

            return (
              <button
                key={index}
                onClick={() => toggleItem(index)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left ${
                  isChecked
                    ? 'border-teal-500/30 bg-teal-500/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isChecked ? 'border-teal-500 bg-teal-500' : 'border-muted-foreground/30'
                  }`}
                >
                  {isChecked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm flex-1 ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                  {item.name}
                </span>
                <Badge variant="secondary" className={`text-xs shrink-0 ${colorClass}`}>
                  {categoryName}
                </Badge>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const PQ_CATEGORY_COLORS: Record<KSIToolCategory, string> = {
  cloud: 'bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30',
  identity: 'bg-violet-500/20 text-violet-700 dark:text-violet-400 border-violet-500/30',
  cicd: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  security: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
  infrastructure: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  grc: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
};

const PQ_CATEGORY_LABELS: Record<KSIToolCategory, string> = {
  cloud: 'Cloud',
  identity: 'Identity',
  cicd: 'CI/CD',
  security: 'Security',
  infrastructure: 'Infrastructure',
  grc: 'GRC',
};

function PQToolTab({ tool }: { tool: KSITool }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-xs ${PQ_CATEGORY_COLORS[tool.category]}`}>
          {PQ_CATEGORY_LABELS[tool.category]}
        </Badge>
      </div>
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">CLI Commands</h4>
        <div className="space-y-3">
          {tool.commands.map((command, index) => (
            <CommandBlock key={index} command={command.command} description={command.description} />
          ))}
        </div>
      </div>
      {tool.docs && (
        <div className="pt-2">
          <a
            href={tool.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {tool.name} Documentation
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

export function AIKSIProgrammaticQueryGrid({ config }: ComponentProps<'KSIProgrammaticQueryGrid'>) {
  const { ksiId } = config;

  const queries = getKSIProgrammaticQueries(ksiId);

  if (!queries || queries.tools.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No programmatic queries available for {ksiId}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { tools } = queries;
  const defaultTab = tools[0].id;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="text-primary font-mono">{'>'}</span>
              Programmatic Queries
            </h4>
            <Badge variant="outline" className="text-xs">
              {tools.length} tools
            </Badge>
          </div>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0 overflow-x-auto flex-nowrap">
              {tools.map(tool => (
                <TabsTrigger
                  key={tool.id}
                  value={tool.id}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  {tool.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {tools.map(tool => (
              <TabsContent key={tool.id} value={tool.id} className="mt-4">
                <PQToolTab tool={tool} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIKSIAssessmentTopicsGrid({ config }: ComponentProps<'KSIAssessmentTopicsGrid'>) {
  const { ksiId } = config;

  const control = getControlById('fedramp-20x-ksi', ksiId);

  if (!control || !control.assessment_questions || control.assessment_questions.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No assessment topics available for {ksiId}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-amber-500/5 border-amber-500/20">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="text-amber-600 dark:text-amber-400 font-mono">{'>'}</span>
              20x Assessment Focus Areas
            </h4>
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
              {control.assessment_questions.reduce((sum, group) => sum + group.questions.length, 0)} questions
            </Badge>
          </div>
          <div className="space-y-5">
            {control.assessment_questions.map(group => (
              <div key={group.category}>
                <h5 className="font-semibold text-sm mb-2">{group.category}:</h5>
                <ul className="space-y-2 ml-1">
                  {group.questions.map((question, index) => (
                    <li key={index} className="text-sm text-foreground/90 flex gap-2">
                      <span className="text-amber-600 dark:text-amber-400 shrink-0">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const KEYWORD_BADGE_STYLES: Record<string, string> = {
  MUST: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  'MUST NOT': 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  SHOULD: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'SHOULD NOT': 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  MAY: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
};

function AIRequirementCard({ req }: { req: FRMRRequirement }) {
  const [showDetails, setShowDetails] = React.useState(false);
  const badgeStyle = KEYWORD_BADGE_STYLES[req.keyword] || KEYWORD_BADGE_STYLES.MAY;
  const hasDetails = (req.followingInformation && req.followingInformation.length > 0) || (req.notes && req.notes.length > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`text-xs ${badgeStyle}`}>
          {req.keyword}
        </Badge>
        <span className="text-xs font-mono text-muted-foreground">{req.id}</span>
      </div>
      {req.name && <h4 className="text-sm font-semibold leading-tight">{req.name}</h4>}
      <p className="text-sm text-muted-foreground leading-relaxed">{req.statement}</p>
      {req.affects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {req.affects.map(affect => (
            <span key={affect} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {affect}
            </span>
          ))}
        </div>
      )}
      {hasDetails && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      )}
      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-1">
          {req.followingInformation?.map((item, index) => <p key={index}>• {item}</p>)}
          {req.notes?.map((note, index) => (
            <p key={index} className="italic">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIKSIRequirementsGrid({ config }: ComponentProps<'KSIRequirementsGrid'>) {
  const { ksiId, filter = 'all' } = config;

  const requirements = getKSIRequirements(ksiId);

  if (!requirements || requirements.requirements.length === 0) {
    return (
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No FRMR requirements available for {ksiId}.
          </p>
        </CardContent>
      </Card>
    );
  }

  let filtered = requirements.requirements;
  if (filter === 'must') {
    filtered = filtered.filter(req => req.keyword === 'MUST' || req.keyword === 'MUST NOT');
  } else if (filter === 'should') {
    filtered = filtered.filter(req => req.keyword === 'SHOULD' || req.keyword === 'SHOULD NOT');
  } else if (filter === 'may') {
    filtered = filtered.filter(req => req.keyword === 'MAY');
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="text-primary font-mono">{'>'}</span>
              FRMR Requirements
            </h4>
            <Badge variant="outline" className="text-xs">
              {filtered.length} requirements
            </Badge>
          </div>
          <div className="grid gap-3">
            {filtered.map(req => (
              <AIRequirementCard key={req.id} req={req} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
