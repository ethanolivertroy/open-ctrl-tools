import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ImplementationStatus,
  ControlStatus,
  AgentConversation,
  AgentMessage,
  AgentThreadMode,
} from '@/lib/db';
import type { AssessmentCryptoModule } from '@/lib/cmvp';
import { clipConversationHistory } from '@/lib/ai/conversation';
import {
  buildGrcLankerWorkbenchPrompt,
  buildGrcLankerSystemPrompt,
  getGrcLankerQuickActions,
  type GrcLankerContext,
} from '@/lib/grclanker-prompts';
import {
  getAgentThreadMode,
  saveAgentConversation,
  getAgentConversationsForControl,
} from '@/lib/storage/agent-store';
import { useAIProviderState } from '@/components/ai/useAIProviderState';
import { useAITextGeneration } from '@/components/ai/useAITextGeneration';

export type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error';

export interface AssessmentGrcLankerProps {
  controlId: string;
  controlTitle: string;
  controlDescription: string;
  family: string;
  familyName: string;
  baseline: string;
  status: ImplementationStatus;
  frameworkParameters?: string;
  frameworkParametersLabel?: string;
  assessmentQuestions?: { category: string; questions: string[] }[];
  userNotes?: string;
  controlStatus?: ControlStatus;
  systemName?: string;
  assessmentId?: string;
  frameworkId?: string;
  evidenceItems?: { evidence_id: string; evidence_title: string; control_application: string; typical_evidence: string }[];
  application?: string;
  frequency?: string;
  linkedCmvpModules?: AssessmentCryptoModule[];
  assessmentCryptoSummary?: string;
  assessmentName?: string;
  assessorName?: string;
  assessorOrg?: string;
  crosswalkSources?: { frameworkId: string; complianceLevel: 'full' | 'partial' }[];
  onOpenAIView?: (context?: {
    frameworkId?: string;
    controlId?: string;
    family?: string;
    assessmentId?: string;
    baseline?: string;
    systemName?: string;
  }, prompt?: string) => void;
}

export function useAssessmentGrcLanker(props: AssessmentGrcLankerProps) {
  const {
    controlId,
    controlTitle,
    controlDescription,
    family,
    familyName,
    baseline,
    status,
    frameworkParameters,
    frameworkParametersLabel,
    assessmentQuestions,
    userNotes,
    controlStatus,
    systemName,
    assessmentId = '_default',
    frameworkId = 'fedramp-rev5',
    evidenceItems,
    application,
    frequency,
    linkedCmvpModules,
    assessmentCryptoSummary,
    assessmentName,
    assessorName,
    assessorOrg,
    crosswalkSources,
    onOpenAIView,
  } = props;

  const [customPrompt, setCustomPrompt] = useState('');
  const {
    hasProvider: hasApiKey,
    activeProvider,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState();

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>(crypto.randomUUID());
  const [threadMode, setThreadMode] = useState<AgentThreadMode>('per-session');
  const [history, setHistory] = useState<AgentConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');

  useEffect(() => {
    getAgentThreadMode().then(setThreadMode);
  }, []);

  const grcLankerCtx: GrcLankerContext = useMemo(() => ({
    controlId,
    controlTitle,
    controlDescription,
    family,
    familyName,
    baseline,
    status,
    frameworkParameters,
    frameworkParametersLabel,
    assessmentQuestions,
    userNotes,
    systemName,
    autoSuggestSource: controlStatus?.autoSuggestSource,
    frameworkId,
    evidenceItems,
    application,
    frequency,
    linkedCmvpModules,
    assessmentCryptoSummary,
    assessmentName,
    assessorName,
    assessorOrg,
    owner: controlStatus?.owner,
    crosswalkSources,
  }), [
    controlId,
    controlTitle,
    controlDescription,
    family,
    familyName,
    baseline,
    status,
    frameworkParameters,
    frameworkParametersLabel,
    assessmentQuestions,
    userNotes,
    systemName,
    controlStatus?.autoSuggestSource,
    controlStatus?.owner,
    frameworkId,
    evidenceItems,
    application,
    frequency,
    linkedCmvpModules,
    assessmentCryptoSummary,
    assessmentName,
    assessorName,
    assessorOrg,
    crosswalkSources,
  ]);

  const quickActions = useMemo(() => getGrcLankerQuickActions(grcLankerCtx), [grcLankerCtx]);
  const systemPrompt = useMemo(() => buildGrcLankerSystemPrompt(grcLankerCtx), [grcLankerCtx]);
  const {
    streamStatus,
    response,
    error,
    requestText,
    stopStreaming,
    clearOutput,
    hydrateResponse,
  } = useAITextGeneration({
    activeProvider,
    systemPrompt,
    context: { frameworkId, controlId, family, assessmentId, baseline, systemName },
    maxOutputTokens: activeProvider === 'grok' ? 12288 : 4096,
    reasoningEffort: activeProvider === 'grok' ? 'medium' : undefined,
    timeoutMs: activeProvider === 'grok' ? 120000 : 60000,
    getTimeoutMessage: (providerName) => `${providerName} took too long to respond. Try a shorter request or switch providers.`,
  });

  useEffect(() => {
    clearOutput();
    setMessages([]);
    setCustomPrompt('');
    setConversationId(crypto.randomUUID());
    setShowHistory(false);

    getAgentConversationsForControl(assessmentId, controlId).then(setHistory);
  }, [assessmentId, clearOutput, controlId]);

  const openWorkbench = useCallback(() => {
    if (!onOpenAIView) return;
    onOpenAIView(
      {
        frameworkId,
        controlId,
        family,
        assessmentId,
        baseline,
        systemName,
      },
      buildGrcLankerWorkbenchPrompt(grcLankerCtx, lastPrompt || customPrompt),
    );
  }, [
    onOpenAIView,
    frameworkId,
    controlId,
    family,
    assessmentId,
    baseline,
    systemName,
    grcLankerCtx,
    lastPrompt,
    customPrompt,
  ]);

  const saveConversationWithId = useCallback(async (nextConversationId: string, nextMessages: AgentMessage[]) => {
    if (nextMessages.length === 0) return;
    const conversation: AgentConversation = {
      id: nextConversationId,
      assessmentId,
      controlId,
      frameworkId,
      messages: nextMessages,
      createdAt: nextMessages[0].timestamp,
      updatedAt: Date.now(),
    };
    await saveAgentConversation(conversation);
    const updated = await getAgentConversationsForControl(assessmentId, controlId);
    setHistory(updated);
  }, [assessmentId, controlId, frameworkId]);

  const generate = useCallback(async (prompt: string) => {
    if (!prompt.trim() || streamStatus === 'streaming') return;

    let nextConversationId = conversationId;
    let priorMessages = messages;

    if (threadMode === 'per-action' && messages.length > 0) {
      nextConversationId = crypto.randomUUID();
      priorMessages = [];
      setMessages([]);
      setConversationId(nextConversationId);
    }

    setLastPrompt(prompt);

    const userMsg: AgentMessage = { role: 'user', content: prompt, timestamp: Date.now() };
    const conversation = threadMode === 'per-session'
      ? clipConversationHistory(
        priorMessages.map((message) => ({ role: message.role, content: message.content })),
      )
      : undefined;
    const fullResponse = await requestText(prompt, { conversation });
    if (!fullResponse) {
      return;
    }

    const assistantMsg: AgentMessage = { role: 'assistant', content: fullResponse, timestamp: Date.now() };
    const nextMessages = [...priorMessages, userMsg, assistantMsg];
    setMessages(nextMessages);
    await saveConversationWithId(nextConversationId, nextMessages);
  }, [
    conversationId,
    messages,
    threadMode,
    streamStatus,
    requestText,
    saveConversationWithId,
  ]);

  const startNewThread = useCallback(() => {
    setMessages([]);
    clearOutput();
    setConversationId(crypto.randomUUID());
    setShowHistory(false);
  }, [clearOutput]);

  const loadConversation = useCallback((conversation: AgentConversation) => {
    setConversationId(conversation.id);
    setMessages(conversation.messages);
    const lastAssistant = [...conversation.messages].reverse().find(message => message.role === 'assistant');
    hydrateResponse(lastAssistant?.content || '');
    setShowHistory(false);
  }, [hydrateResponse]);

  return {
    streamStatus,
    response,
    error,
    customPrompt,
    setCustomPrompt,
    hasApiKey,
    activeProvider,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
    messages,
    conversationId,
    history,
    showHistory,
    setShowHistory,
    quickActions,
    generate,
    openWorkbench,
    startNewThread,
    loadConversation,
    stopStreaming,
  };
}
