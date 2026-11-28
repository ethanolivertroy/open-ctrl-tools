import {
  getCrossFrameworkMappingsFromIndex,
  loadCrosswalkIndex,
  loadFrameworkDataset,
} from '@/lib/client-framework-data';
import type { ControlSearchPayload } from '@/lib/search/build-artifacts';
import { getUiAgent, type AgentStep } from '@/lib/ui-agent';
import type { VoiceToolDescriptor } from './protocol';

export const VOICE_TOOL_DESCRIPTORS: VoiceToolDescriptor[] = [
  {
    name: 'search_controls',
    description: 'Search controls and frameworks across myctrl.tools by control ID, title, or security topic.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Control ID or security keyword, e.g. AC-2 or phishing-resistant MFA' },
        frameworkId: { type: 'string', description: 'Optional framework ID filter such as nist-800-53-r5 or fedramp-20x-ksi' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_control_context',
    description: 'Fetch detailed control description, implementation guidance, parameters, and baselines for a framework control.',
    parameters: {
      type: 'object',
      properties: {
        frameworkId: { type: 'string', description: 'Framework ID such as nist-800-53-r5' },
        controlIdOrSlug: { type: 'string', description: 'Control ID (AC-2) or slug (ac-2)' },
      },
      required: ['frameworkId', 'controlIdOrSlug'],
    },
  },
  {
    name: 'get_crosswalks',
    description: 'Look up cross-framework control mappings and equivalent requirements for a control.',
    parameters: {
      type: 'object',
      properties: {
        frameworkId: { type: 'string' },
        controlId: { type: 'string' },
      },
      required: ['frameworkId', 'controlId'],
    },
  },
  {
    name: 'inspect_ui',
    description: 'Inspect interactive ui-sdk components currently visible in the myctrl.tools interface.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ui_act',
    description: 'Perform an action on an interactive ui-sdk component by ref or label.',
    parameters: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Component ref or label from inspect_ui' },
        action: { type: 'string', description: 'Action name reported by inspect_ui' },
        args: { type: 'array', items: {}, description: 'Arguments for the action' },
      },
      required: ['ref', 'action'],
    },
  },
];

let cachedSearchPayload: ControlSearchPayload | null = null;

async function fetchControlSearchIndex(): Promise<ControlSearchPayload> {
  if (cachedSearchPayload) return cachedSearchPayload;
  const resp = await fetch('/api/search/control-index.json', {
    headers: { accept: 'application/json' },
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch control search index (${resp.status})`);
  }
  cachedSearchPayload = (await resp.json()) as ControlSearchPayload;
  return cachedSearchPayload;
}

export async function executeVoiceTool(
  name: string,
  args: Record<string, unknown>,
  fallbackContext?: { frameworkId?: string; controlSlug?: string },
): Promise<unknown> {
  if (name === 'search_controls') {
    const query = String(args.query || '').trim().toLowerCase();
    const frameworkId = typeof args.frameworkId === 'string' ? args.frameworkId : undefined;
    if (!query) return { results: [] };

    const index = await fetchControlSearchIndex();
    const results = index.entries
      .filter((tuple) => {
        const [id, title, family, description, fwId] = tuple;
        if (frameworkId && fwId !== frameworkId) return false;
        return (
          id.toLowerCase().includes(query) ||
          title.toLowerCase().includes(query) ||
          description.toLowerCase().includes(query) ||
          family.toLowerCase().includes(query)
        );
      })
      .slice(0, 8)
      .map(([id, title, family, description, fwId, _href, baselines]) => ({
        frameworkId: fwId,
        id,
        title,
        family,
        baselines,
        summary: description.slice(0, 220),
      }));

    return { count: results.length, results };
  }

  if (name === 'get_control_context') {
    const frameworkId = String(args.frameworkId || fallbackContext?.frameworkId || '');
    const target = String(args.controlIdOrSlug || fallbackContext?.controlSlug || '').toLowerCase();
    if (!frameworkId || !target) {
      return { error: 'Missing frameworkId or control identifier' };
    }

    const payload = await loadFrameworkDataset(frameworkId);
    const control = payload.controls.find(
      (c) =>
        c.control_id.toLowerCase() === target ||
        (c.url && c.url.toLowerCase().endsWith(`/${target}`)) ||
        c.control_id.toLowerCase().replace(/[^a-z0-9]+/g, '-') === target,
    );

    if (!control) {
      return { error: `Control ${target} not found in ${frameworkId}` };
    }

    const record = control as unknown as Record<string, unknown>;
    return {
      framework: payload.config.name,
      control_id: control.control_id,
      title: control.title,
      family: control.family,
      description: String(record.description || record.statement || '').slice(0, 900),
      guidance: String(record.guidance || record.supplemental_guidance || '').slice(0, 700),
      assessment_questions: record.assessment_questions ?? record.assessment_objectives,
    };
  }

  if (name === 'get_crosswalks') {
    const frameworkId = String(args.frameworkId || fallbackContext?.frameworkId || '');
    const controlId = String(args.controlId || fallbackContext?.controlSlug || '');
    if (!frameworkId || !controlId) {
      return { mappings: [] };
    }

    const index = await loadCrosswalkIndex();
    const mappings = getCrossFrameworkMappingsFromIndex({
      index,
      frameworkId,
      controlId,
    });
    return { mappings: mappings.slice(0, 12) };
  }

  if (name === 'inspect_ui') {
    const agent = getUiAgent();
    return { components: agent.snapshot() };
  }

  if (name === 'ui_act') {
    const ref = String(args.ref || '');
    const action = String(args.action || '');
    if (!ref || !action) {
      return { error: 'Both ref and action are required' };
    }
    const agent = getUiAgent();
    const steps: AgentStep[] = [
      {
        ref,
        action,
        args: Array.isArray(args.args) ? args.args : undefined,
      },
    ];
    return agent.act({ steps });
  }

  return { error: `Unknown tool: ${name}` };
}
