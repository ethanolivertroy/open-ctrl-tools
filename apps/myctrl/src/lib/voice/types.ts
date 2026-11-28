import type { VoiceMode, VoiceProviderId } from './protocol';

export type VoiceConnectionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface VoiceTranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  final: boolean;
  timestamp: number;
}

export interface VoiceSessionStartOptions {
  provider: VoiceProviderId;
  mode: VoiceMode;
  voice?: string;
  apiKey?: string;
  frameworkId?: string;
  controlSlug?: string;
  controlTitle?: string;
  assessmentQuestions?: string[];
  onStateChange: (state: VoiceConnectionState) => void;
  onTranscript: (entry: VoiceTranscriptEntry) => void;
  onToolActivity?: (label: string) => void;
  onInputLevel?: (level: number) => void;
  onOutputLevel?: (level: number) => void;
  onError: (message: string) => void;
}

export interface ActiveVoiceTransport {
  readonly provider: VoiceProviderId;
  setMuted: (muted: boolean) => void;
  interrupt: () => void;
  sendTextTurn?: (text: string) => void;
  stop: () => Promise<void>;
}

export interface EphemeralVoiceSessionResponse {
  provider: Exclude<VoiceProviderId, 'browser'>;
  transport: 'webrtc' | 'websocket';
  model: string;
  voice: string;
  wsUrl?: string;
  ephemeralToken?: string;
  directApiKey?: string;
  expiresAt?: string | number;
}
