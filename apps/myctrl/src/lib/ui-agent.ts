import { agentTools, createAgent, registerTools, type AgentAction, type AgentComponent, type AgentStep } from '@ui-sdk/react/agent';

type UiAgentInstance = ReturnType<typeof createAgent>;

let sharedAgent: UiAgentInstance | null = null;
let webMcpUnregister: (() => void) | null = null;

function defaultAllow(step: AgentAction): boolean {
  if (!step.confirm) return true;
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(step.confirm);
  }
  return false;
}

export function getUiAgent(): UiAgentInstance {
  if (!sharedAgent) {
    sharedAgent = createAgent({
      allow: (step) => defaultAllow(step),
    });
  }
  return sharedAgent;
}

export function initUiAgent(): UiAgentInstance {
  const agent = getUiAgent();
  if (typeof document !== 'undefined' && !webMcpUnregister) {
    try {
      webMcpUnregister = registerTools(agent, { allow: () => true });
    } catch {
      webMcpUnregister = null;
    }
  }
  return agent;
}

export function teardownUiAgent() {
  if (webMcpUnregister) {
    webMcpUnregister();
    webMcpUnregister = null;
  }
}

export { agentTools, type AgentAction, type AgentComponent, type AgentStep };
