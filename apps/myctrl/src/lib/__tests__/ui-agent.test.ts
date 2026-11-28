import { describe, expect, it } from 'vitest';
import { agentTools, createAgent } from '@ui-sdk/react/agent';

describe('ui-sdk agent bridge', () => {
  it('exposes snapshot, query, and act tool definitions', () => {
    const names = agentTools.map((t) => t.name).sort();
    expect(names).toEqual(['act', 'query', 'snapshot']);

    for (const tool of agentTools) {
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeTruthy();
    }
  });

  it('creates an agent bridge that enforces allow gating on confirm steps', () => {
    const agent = createAgent({
      allow: (step) => !step.confirm,
    });
    expect(typeof agent.snapshot).toBe('function');
    expect(typeof agent.act).toBe('function');
    expect(typeof agent.query).toBe('function');
    expect(typeof agent.subscribe).toBe('function');
  });
});
