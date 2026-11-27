export const prerender = false;

import type { APIRoute } from 'astro';
import { withReadOnlyApi } from '@/lib/api-route';
import { apiSuccess, apiError, getDataVersion } from '@/lib/api-response';
import { getTechnologyById, getTechnologyPath } from '@/data/technology-guides';
import { getGoodBadExamplePresentation, resolveComparisonTitle } from '@/components/guidance/good-bad-parser';

export const GET: APIRoute = withReadOnlyApi(async (context) => {
  const slug = context.params.slug;

  if (!slug) {
    return apiError('bad_request', 'Technology slug is required.');
  }

  const guide = getTechnologyById(slug);
  if (!guide) {
    return apiError('not_found', `Technology guide '${slug}' not found.`);
  }

  const serializeExample = (e: NonNullable<typeof guide.authoritativeSources[number]['configExamples']>[number]) => {
    const presentation = getGoodBadExamplePresentation(e.code);

    return {
      title: e.title,
      comparison_title: presentation.mode !== 'plain'
        ? resolveComparisonTitle(e.title, {
            comparisonTitle: e.comparisonTitle,
            isSemanticExample: true,
          })
        : null,
      language: e.language,
      code: e.code,
      source: e.source || null,
      source_url: e.sourceUrl || null,
      discussion: e.discussion || null,
    };
  };

  const serializeCommand = (c: typeof guide.commands[number]) => ({
    description: c.description,
    command: c.command,
    type: c.type,
    group: c.group || null,
    scope: c.scope || null,
    notes: c.notes || null,
  });

  return apiSuccess({
    id: `guidance:${guide.id}`,
    technology_slug: guide.id,
    name: guide.name,
    category: guide.category,
    vendor: guide.vendor || null,
    description: guide.description,
    official_url: guide.officialUrl || null,

    authoritative_sources: guide.authoritativeSources.map((s) => ({
      id: s.id || null,
      type: s.type,
      title: s.title,
      url: s.url,
      summary: s.summary || null,
      additional_urls: s.additionalUrls?.map((link) => ({
        label: link.label,
        url: link.url,
      })) || [],
      config_examples: s.configExamples?.map(serializeExample) || [],
    })),

    commands: guide.commands.map(serializeCommand),

    tools: guide.tools?.map((tool) => ({
      id: tool.id,
      name: tool.name,
      summary: tool.summary,
      repo: tool.repo || null,
      url: tool.url || null,
      quick_command: tool.quickCommand || null,
      notes: tool.notes || null,
    })) || [],

    playbook: guide.playbook ? {
      intro: guide.playbook.intro,
      sections: guide.playbook.sections.map((section) => ({
        id: section.id,
        title: section.title,
        priority: section.priority,
        summary: section.summary,
        actions: section.actions,
        examples: section.examples.map(serializeExample),
        commands: section.commands.map(serializeCommand),
        source_ids: section.sourceIds,
        tool_ids: section.toolIds || [],
      })),
    } : null,

    control_mappings: guide.controlMappings.map((m) => ({
      framework_id: m.frameworkId,
      control_ids: m.controlIds,
    })),

    responsibilities: guide.responsibilities?.map((s) => ({
      title: s.title,
      description: s.description || null,
      items: s.items.map((i) => ({
        title: i.title,
        description: i.description || null,
        controls: i.controls || [],
      })),
    })) || [],

    related_technologies: guide.relatedTechnologies || [],
    github_repos: guide.githubRepos || [],
    canonical_url: `https://myctrl.tools${getTechnologyPath(guide)}`,
    data_version: getDataVersion(),
  });
});
