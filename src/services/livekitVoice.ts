/**
 * LiveKit voice session (web only).
 *
 * Connects the PWA to a LiveKit room where the "hablaya-tutor" agent listens
 * and speaks. The server (POST /api/livekit/token) creates the room and
 * dispatches the agent; this module only joins, plays the agent's audio,
 * and reports state + transcripts to the UI.
 */

import { Platform } from 'react-native';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteTrack,
  type RemoteParticipant,
  type TextStreamReader,
} from 'livekit-client';
import { loadStoredToken } from '@/src/services/authApi';

export type VoiceState =
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'idle'
  | 'error';

export interface VoiceTranscript {
  /** Segment id: later updates with the same id replace earlier ones. */
  id: string;
  role: 'user' | 'tutor';
  text: string;
  final: boolean;
}

export interface VoiceScenario {
  id: string;
  title: string;
  titleEs: string;
  context: string;
  theme: string;
}

export interface VoiceSessionOptions {
  level: string;
  scenario?: VoiceScenario;
  greeting?: string;
  onState: (state: VoiceState) => void;
  onTranscript: (transcript: VoiceTranscript) => void;
  onError: (message: string) => void;
  onNeedsAudioTap: (needed: boolean) => void;
}

export interface VoiceSession {
  stop(): Promise<void>;
  /** Call from a tap handler when onNeedsAudioTap(true) was reported. */
  enableAudio(): Promise<void>;
}

interface TokenResponse {
  token: string;
  url: string;
  room: string;
}

const TRANSCRIPTION_TOPIC = 'lk.transcription';
const ATTR_AGENT_STATE = 'lk.agent.state';
const ATTR_SEGMENT_ID = 'lk.segment_id';
const ATTR_TRANSCRIPTION_FINAL = 'lk.transcription_final';
const AGENT_JOIN_TIMEOUT_MS = 20000;

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function fetchVoiceToken(options: VoiceSessionOptions): Promise<TokenResponse> {
  const authToken = await loadStoredToken();
  if (!authToken) {
    throw new Error('Je bent niet ingelogd. Log opnieuw in.');
  }

  let response: Response;
  try {
    response = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        level: options.level,
        scenario: options.scenario,
        greeting: options.greeting,
      }),
    });
  } catch {
    throw new Error('Geen verbinding met de server. Controleer je internet.');
  }

  if (response.status === 401) {
    throw new Error('Je sessie is verlopen. Log opnieuw in.');
  }
  if (response.status === 503) {
    throw new Error('Spraak is nog niet ingesteld op de server.');
  }
  if (!response.ok) {
    throw new Error(`De spraaksessie kon niet starten (fout ${response.status}).`);
  }

  const data = (await response.json()) as Partial<TokenResponse>;
  if (!data.token || !data.url) {
    throw new Error('De server gaf een onvolledig antwoord. Probeer het opnieuw.');
  }
  return { token: data.token, url: data.url, room: data.room ?? '' };
}

export function startVoiceSession(options: VoiceSessionOptions): VoiceSession {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    options.onState('error');
    options.onError('Spraak werkt alleen in de webversie van de app.');
    return { stop: async () => {}, enableAudio: async () => {} };
  }

  const room = new Room();
  const audioElements = new Set<HTMLMediaElement>();
  let stopped = false;
  let lastState: VoiceState | null = null;
  let agentTimer: ReturnType<typeof setTimeout> | null = null;

  const emitState = (state: VoiceState): void => {
    if (stopped || state === lastState) return;
    lastState = state;
    options.onState(state);
  };

  const fail = (message: string): void => {
    if (stopped) return;
    options.onError(message);
    emitState('error');
    clearAgentTimer();
    room.disconnect().catch(() => {});
  };

  const clearAgentTimer = (): void => {
    if (agentTimer) {
      clearTimeout(agentTimer);
      agentTimer = null;
    }
  };

  const readAgentState = (): string | undefined => {
    for (const participant of room.remoteParticipants.values()) {
      const value = participant.attributes[ATTR_AGENT_STATE];
      if (value) return value;
    }
    return undefined;
  };

  const updateState = (): void => {
    if (stopped) return;
    if (lastState === 'error') return;
    switch (room.state) {
      case ConnectionState.Disconnected:
        emitState('idle');
        return;
      case ConnectionState.Connecting:
      case ConnectionState.Reconnecting:
      case ConnectionState.SignalReconnecting:
        emitState('connecting');
        return;
      default:
        break;
    }
    const agentState = readAgentState();
    if (agentState === 'listening' || agentState === 'thinking' || agentState === 'speaking') {
      clearAgentTimer();
      emitState(agentState);
    } else if (agentState === 'idle') {
      clearAgentTimer();
      emitState('idle');
    } else {
      // No agent yet, or the agent is still 'initializing'.
      emitState('connecting');
    }
  };

  const playElement = (element: HTMLMediaElement): void => {
    element.play().catch(() => options.onNeedsAudioTap(true));
  };

  const onTrackSubscribed = (track: RemoteTrack): void => {
    if (stopped || track.kind !== Track.Kind.Audio) return;
    // livekit-client 2.x does not auto-play remote audio: attach it ourselves.
    const element = track.attach();
    element.style.display = 'none';
    document.body.appendChild(element);
    audioElements.add(element);
    playElement(element);
  };

  const onTrackUnsubscribed = (track: RemoteTrack): void => {
    for (const element of track.detach()) {
      audioElements.delete(element);
      element.remove();
    }
  };

  const onAttributesChanged = (_changed: Record<string, string>, participant: unknown): void => {
    if (participant === room.localParticipant) return;
    updateState();
  };

  const onParticipantChange = (_participant: RemoteParticipant): void => {
    updateState();
  };

  const onPlaybackChanged = (playing: boolean): void => {
    if (stopped) return;
    options.onNeedsAudioTap(!playing);
  };

  const onDisconnected = (): void => {
    if (stopped || lastState === 'error') return;
    clearAgentTimer();
    emitState('idle');
  };

  const handleTranscriptStream = async (
    reader: TextStreamReader,
    senderIdentity: string
  ): Promise<void> => {
    const role: 'user' | 'tutor' =
      senderIdentity === room.localParticipant.identity ? 'user' : 'tutor';
    const attributes = reader.info.attributes ?? {};
    const id = attributes[ATTR_SEGMENT_ID] ?? reader.info.id;
    let text = '';
    try {
      for await (const chunk of reader) {
        if (stopped) return;
        text += chunk;
        options.onTranscript({ id, role, text, final: false });
      }
    } catch {
      // Stream interrupted (for example while stopping): keep what we have.
    }
    if (stopped) return;
    const finalAttr = (reader.info.attributes ?? {})[ATTR_TRANSCRIPTION_FINAL];
    // A finished tutor stream is complete; a user stream is only final when flagged.
    const final = role === 'tutor' ? true : finalAttr === 'true';
    if (text) options.onTranscript({ id, role, text, final });
  };

  const removeListeners = (): void => {
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);
    room.off(RoomEvent.ParticipantConnected, onParticipantChange);
    room.off(RoomEvent.ParticipantDisconnected, onParticipantChange);
    room.off(RoomEvent.ConnectionStateChanged, updateState);
    room.off(RoomEvent.AudioPlaybackStatusChanged, onPlaybackChanged);
    room.off(RoomEvent.Disconnected, onDisconnected);
    room.unregisterTextStreamHandler(TRANSCRIPTION_TOPIC);
  };

  const cleanupAudioElements = (): void => {
    for (const element of audioElements) {
      element.pause();
      element.srcObject = null;
      element.remove();
    }
    audioElements.clear();
  };

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    clearAgentTimer();
    removeListeners();
    try {
      await room.disconnect();
    } catch {
      // ignore: we are tearing down anyway
    }
    cleanupAudioElements();
    options.onNeedsAudioTap(false);
    options.onState('idle');
  };

  const enableAudio = async (): Promise<void> => {
    if (stopped) return;
    try {
      await room.startAudio();
      audioElements.forEach(playElement);
      options.onNeedsAudioTap(!room.canPlaybackAudio);
    } catch {
      options.onNeedsAudioTap(true);
    }
  };

  const run = async (): Promise<void> => {
    emitState('connecting');

    // Register everything before connecting so no early event is missed.
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);
    room.on(RoomEvent.ParticipantConnected, onParticipantChange);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChange);
    room.on(RoomEvent.ConnectionStateChanged, updateState);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onPlaybackChanged);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.registerTextStreamHandler(TRANSCRIPTION_TOPIC, (reader, participantInfo) => {
      void handleTranscriptStream(reader, participantInfo.identity);
    });

    // Must happen inside the tap gesture (before any await): unlocks audio on iOS.
    room.startAudio().catch(() => options.onNeedsAudioTap(true));

    let credentials: TokenResponse;
    try {
      credentials = await fetchVoiceToken(options);
    } catch (err) {
      fail(errorText(err));
      return;
    }
    if (stopped) return;

    try {
      await room.connect(credentials.url, credentials.token);
    } catch (err) {
      fail(`Verbinden met de spraakdienst mislukt: ${errorText(err)}`);
      return;
    }
    if (stopped) return;

    agentTimer = setTimeout(() => {
      agentTimer = null;
      if (!stopped && !readAgentState()) {
        fail('De tutor is niet beschikbaar. Probeer het later opnieuw.');
      }
    }, AGENT_JOIN_TIMEOUT_MS);

    try {
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
    } catch (err) {
      fail(`Geen toegang tot de microfoon: ${errorText(err)}`);
      return;
    }
    updateState();
  };

  run().catch((err) => fail(errorText(err)));

  return { stop, enableAudio };
}
