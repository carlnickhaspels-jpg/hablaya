import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { colors, typography, spacing, borderRadius, shadows } from '@/src/constants/theme';
import { Message, Correction } from '@/src/types';
import { getScenarioById } from '@/src/constants/scenarios';
import { useApp } from '@/src/contexts/AppContext';
import {
  getInitialGreeting,
  getSpanishHint,
} from '@/src/services/ai';
import { playAudio, unlockAudio } from '@/src/services/speech';
import {
  startVoiceSession,
  type VoiceSession,
  type VoiceState,
  type VoiceTranscript,
} from '@/src/services/livekitVoice';
import MicButton from '@/src/components/MicButton';
import CorrectionCard from '@/src/components/CorrectionCard';
import TranslatePopup from '@/src/components/TranslatePopup';
import ImprovePopup from '@/src/components/ImprovePopup';
import HintBar from '@/src/components/HintBar';
import {
  trackConversationStart,
  trackConversationEnd,
  trackUserMessage,
  trackHintRequested,
  trackImproveRequested,
  trackTranslateUsed,
} from '@/src/services/analytics';

// Maximum wait (ms) for the agent's greeting to finish before a queued typed
// message is sent anyway (the agent ignores text while its greeting plays).
const QUEUED_TEXT_MAX_WAIT_MS = 20000;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Typing indicator with animated dots
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = createDotAnimation(dot1, 0);
    const anim2 = createDotAnimation(dot2, 200);
    const anim3 = createDotAnimation(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  });

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.typingDot, dotStyle(dot)]} />
        ))}
      </View>
    </View>
  );
}

// Animated waveform bars for recording state
function WaveformBars() {
  const bars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(bar, {
            toValue: 0.6 + Math.random() * 0.4,
            duration: 300 + Math.random() * 200,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.2 + Math.random() * 0.2,
            duration: 300 + Math.random() * 200,
            useNativeDriver: true,
          }),
        ])
      )
    );

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [bars]);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            { transform: [{ scaleY: bar }] },
          ]}
        />
      ))}
    </View>
  );
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useApp();
  const userLevel = user?.level ?? 'principiante';

  const scenario = id && id !== 'free-talk' ? getScenarioById(id) : undefined;
  const screenTitle = scenario?.title ?? 'Free Talk';

  const [messages, setMessages] = useState<Message[]>([]);
  // Corrections are no longer produced by the voice agent; kept so the summary
  // and the inline CorrectionCard keep working (they simply get no data).
  const [corrections] = useState<Correction[]>([]);
  const [state, setState] = useState<VoiceState>('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tap-to-translate, improve, and hint UI state
  const [translateText, setTranslateText] = useState<string | null>(null);
  const [translateContext, setTranslateContext] = useState<string | undefined>(undefined);
  const [improveText, setImproveText] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Typed messages waiting until the agent is ready to receive them
  const [pendingTexts, setPendingTexts] = useState<string[]>([]);
  // True once the agent's greeting transcript has finished (or none is expected)
  const [greetingDone, setGreetingDone] = useState(false);
  // Message ids whose transcript is still being updated (interim)
  const [interimIds, setInterimIds] = useState<string[]>([]);

  const sessionRef = useRef<VoiceSession | null>(null);
  // Incremented on every start/stop so callbacks of an old session are ignored
  const sessionTokenRef = useRef(0);
  const greetingIdRef = useRef<string>(generateId());
  // The agent has started speaking its greeting (so a later session must not repeat it)
  const greetingSpokenRef = useRef(false);
  // The running session was started with a greeting and has not delivered it yet
  const greetingPendingRef = useRef(false);
  // `${role}:${segmentId}` -> message id
  const segmentMapRef = useRef<Map<string, string>>(new Map());
  const countedUserSegmentsRef = useRef<Set<string>>(new Set());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date>(new Date());

  // Corrections grouped by message ID for inline display
  const correctionsByMessageId = useRef<Map<string, Correction[]>>(new Map());

  // Start the session timer
  useEffect(() => {
    startTimeRef.current = new Date();
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Analytics: log when a conversation begins
  useEffect(() => {
    trackConversationStart(id ?? 'free-talk', scenario?.theme);
  }, [id, scenario?.theme]);

  // Show the greeting as text only. The agent speaks it itself once the
  // session starts; its transcript is merged into this bubble.
  useEffect(() => {
    const greeting = getInitialGreeting(scenario, userLevel);
    const tutorMessage: Message = {
      id: greetingIdRef.current,
      role: 'tutor',
      content: greeting,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => (prev.length <= 1 ? [tutorMessage] : prev));
  }, [scenario, userLevel]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages, state]);

  // Insert or update a message from a LiveKit transcript segment.
  const handleTranscript = useCallback(
    (transcript: VoiceTranscript) => {
      const key = `${transcript.role}:${transcript.id}`;
      let messageId = segmentMapRef.current.get(key);
      if (!messageId) {
        if (
          transcript.role === 'tutor' &&
          greetingPendingRef.current &&
          !greetingSpokenRef.current
        ) {
          // First tutor transcript = the greeting: merge into the existing bubble
          messageId = greetingIdRef.current;
          greetingSpokenRef.current = true;
        } else {
          messageId = generateId();
        }
        segmentMapRef.current.set(key, messageId);
      }
      const targetId = messageId;

      if (transcript.role === 'tutor' && targetId === greetingIdRef.current && transcript.final) {
        setGreetingDone(true);
      }

      if (
        transcript.role === 'user' &&
        transcript.final &&
        !countedUserSegmentsRef.current.has(key)
      ) {
        countedUserSegmentsRef.current.add(key);
        trackUserMessage(id ?? 'free-talk', false);
      }

      const timestamp = new Date().toISOString();
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === targetId);
        if (index === -1) {
          return [
            ...prev,
            { id: targetId, role: transcript.role, content: transcript.text, timestamp },
          ];
        }
        const next = [...prev];
        next[index] = { ...prev[index], content: transcript.text };
        return next;
      });
      setInterimIds((prev) => {
        const has = prev.includes(targetId);
        if (transcript.final) return has ? prev.filter((x) => x !== targetId) : prev;
        return has ? prev : [...prev, targetId];
      });
    },
    [id]
  );

  // Forget the running session (error, disconnect or user stop).
  const dropSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    sessionTokenRef.current += 1;
    setSessionActive(false);
    setNeedsAudioTap(false);
    setPendingTexts([]);
    setInterimIds([]);
    if (session) session.stop().catch(() => {});
  }, []);

  // Start a LiveKit voice session. Must be called synchronously from a tap
  // handler (after unlockAudio) so iOS allows audio playback.
  const startSession = useCallback(() => {
    setErrorMessage(null);
    setNeedsAudioTap(false);
    setSessionActive(true);
    setState('connecting');

    const token = sessionTokenRef.current + 1;
    sessionTokenRef.current = token;
    const isCurrent = () => sessionTokenRef.current === token;

    // The agent greets once per conversation screen; a restart stays silent.
    const expectGreeting = !greetingSpokenRef.current;
    greetingPendingRef.current = expectGreeting;
    setGreetingDone(!expectGreeting);

    let ended = false;
    const session = startVoiceSession({
      level: userLevel,
      scenario: scenario
        ? {
            id: scenario.id,
            title: scenario.title,
            titleEs: scenario.titleEs,
            context: scenario.context,
            theme: scenario.theme,
          }
        : undefined,
      greeting: expectGreeting ? getInitialGreeting(scenario, userLevel) : undefined,
      onState: (voiceState) => {
        if (!isCurrent()) return;
        setState(voiceState);
        if (voiceState === 'error' || voiceState === 'idle') {
          ended = true;
          dropSession();
        }
      },
      onTranscript: (transcript) => {
        if (isCurrent()) handleTranscript(transcript);
      },
      onError: (message) => {
        if (isCurrent()) setErrorMessage(message);
      },
      onNeedsAudioTap: (needed) => {
        if (isCurrent()) setNeedsAudioTap(needed);
      },
    });
    if (ended) {
      session.stop().catch(() => {});
    } else {
      sessionRef.current = session;
    }
  }, [scenario, userLevel, handleTranscript, dropSession]);

  // Mic toggle.
  // - No session: tap starts a LiveKit session (mic opens, Carlos greets and listens).
  // - Session running: tap stops it.
  const handleMicPress = useCallback(() => {
    // iOS: unlock audio playback NOW, while the user-gesture context is alive.
    unlockAudio();

    if (sessionRef.current) {
      dropSession();
      setState('idle');
      return;
    }
    startSession();
  }, [dropSession, startSession]);

  // Stop the session when the screen is left
  useEffect(() => {
    return () => {
      sessionTokenRef.current += 1;
      sessionRef.current?.stop().catch(() => {});
      sessionRef.current = null;
    };
  }, []);

  // Send queued typed messages once the agent can take them: after its
  // greeting (the agent ignores text while the greeting plays) or, as a
  // safety net, after a maximum wait.
  useEffect(() => {
    if (pendingTexts.length === 0) return;
    if (state !== 'listening' && state !== 'thinking' && state !== 'speaking') return;

    const flush = () => {
      const session = sessionRef.current;
      if (!session) return;
      const texts = pendingTexts;
      setPendingTexts([]);
      void (async () => {
        for (const text of texts) {
          try {
            await session.sendText(text);
          } catch (err: any) {
            setErrorMessage(err?.message || 'Het bericht kon niet worden verstuurd.');
            return;
          }
        }
      })();
    };

    if (greetingDone) {
      flush();
      return;
    }
    const timeout = setTimeout(flush, QUEUED_TEXT_MAX_WAIT_MS);
    return () => clearTimeout(timeout);
  }, [pendingTexts, state, greetingDone]);

  const handleSendText = useCallback(() => {
    const text = textInputValue.trim();
    if (!text) return;

    // iOS audio-unlock: capture the user-gesture context NOW so the session
    // (if it has to start) and Carlos's reply audio are allowed to play.
    unlockAudio();

    Keyboard.dismiss();

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    trackUserMessage(id ?? 'free-talk', false);

    setTextInputValue('');
    setMessages((prev) => [...prev, userMessage]);
    setPendingTexts((prev) => [...prev, text]);

    if (!sessionRef.current) {
      startSession();
    }
  }, [textInputValue, startSession, id]);

  const handleEnableAudio = useCallback(() => {
    unlockAudio();
    void sessionRef.current?.enableAudio();
  }, []);

  const handlePlayAudio = useCallback((text: string) => {
    playAudio(text);
  }, []);

  const handleHintRequest = useCallback(async () => {
    trackHintRequested(id ?? 'free-talk');
    setHintLoading(true);
    setHint(null);
    try {
      const result = await getSpanishHint(messages, scenario);
      setHint(result || 'No hint available right now.');
    } catch {
      setHint('Could not get a hint. Please try again.');
    } finally {
      setHintLoading(false);
    }
  }, [messages, scenario, id]);

  const handleWordTap = useCallback((word: string, fullMessage: string) => {
    // Strip punctuation
    const cleaned = word.replace(/[.,!?;:¡¿"'()]/g, '').trim();
    if (!cleaned) return;
    trackTranslateUsed(cleaned);
    setTranslateContext(fullMessage);
    setTranslateText(cleaned);
  }, []);

  const handleMessageLongPress = useCallback((fullMessage: string) => {
    setTranslateContext(undefined);
    setTranslateText(fullMessage);
  }, []);

  const handleImproveMessage = useCallback((text: string) => {
    trackImproveRequested();
    setImproveText(text);
  }, []);

  const handleEndSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    dropSession();

    trackConversationEnd(id ?? 'free-talk', duration, messages.length);

    router.push({
      pathname: '/conversation/summary',
      params: {
        messagesJson: JSON.stringify(messages),
        correctionsJson: JSON.stringify(corrections),
        duration: duration.toString(),
        scenarioId: id ?? 'free-talk',
      },
    });
  }, [router, messages, corrections, duration, id, dropSession]);

  const renderTappableText = (text: string, isTutor: boolean) => {
    // Split into words but preserve spacing — wrap each word in a Text that opens the translate popup
    const tokens = text.split(/(\s+)/);
    return (
      <Text
        style={[
          styles.messageText,
          isTutor ? styles.tutorMessageText : styles.userMessageText,
        ]}
      >
        {tokens.map((token, i) => {
          if (/^\s+$/.test(token)) return token;
          return (
            <Text
              key={i}
              onPress={() => handleWordTap(token, text)}
              suppressHighlighting
            >
              {token}
            </Text>
          );
        })}
      </Text>
    );
  };

  const renderMessage = (message: Message, index: number) => {
    const isTutor = message.role === 'tutor';
    const messageCorrections = correctionsByMessageId.current.get(message.id) ?? [];

    return (
      <View key={message.id}>
        <View
          style={[
            styles.messageBubbleWrapper,
            isTutor ? styles.tutorBubbleWrapper : styles.userBubbleWrapper,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.95}
            onLongPress={() => handleMessageLongPress(message.content)}
            style={[
              styles.messageBubble,
              isTutor ? styles.tutorBubble : styles.userBubble,
              interimIds.includes(message.id) && styles.bubbleInterim,
            ]}
          >
            {renderTappableText(message.content, isTutor)}

            {isTutor && (
              <View style={styles.tutorActionsRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handlePlayAudio(message.content)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="volume-medium"
                    size={16}
                    color={colors.white}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleMessageLongPress(message.content)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="language"
                    size={16}
                    color={colors.white}
                  />
                </TouchableOpacity>
              </View>
            )}

            {!isTutor && (
              <View style={styles.userActionsRow}>
                <TouchableOpacity
                  style={styles.userActionButton}
                  onPress={() => handleImproveMessage(message.content)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="sparkles" size={14} color={colors.softOrange} />
                  <Text style={styles.userActionText}>Improve</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isTutor && message.pronunciationScore !== undefined && (
              <View style={styles.scoreContainer}>
                <View
                  style={[
                    styles.scoreBadge,
                    {
                      backgroundColor:
                        message.pronunciationScore >= 80
                          ? colors.successGreen + '20'
                          : message.pronunciationScore >= 70
                          ? colors.softOrange + '20'
                          : colors.errorRed + '20',
                    },
                  ]}
                >
                  <Ionicons
                    name="mic"
                    size={12}
                    color={
                      message.pronunciationScore >= 80
                        ? colors.successGreen
                        : message.pronunciationScore >= 70
                        ? colors.softOrange
                        : colors.errorRed
                    }
                  />
                  <Text
                    style={[
                      styles.scoreText,
                      {
                        color:
                          message.pronunciationScore >= 80
                            ? colors.successGreen
                            : message.pronunciationScore >= 70
                            ? colors.softOrange
                            : colors.errorRed,
                      },
                    ]}
                  >
                    {message.pronunciationScore}%
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {messageCorrections.map((correction) => (
          <CorrectionCard key={correction.id} correction={correction} />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.topBarButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={26} color={colors.darkText} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {screenTitle}
          </Text>
          <View style={styles.timerContainer}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.timerText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleEndSession}
          style={styles.endSessionButton}
        >
          <Text style={styles.endSessionText}>End</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, idx) => renderMessage(msg, idx))}

          {state === 'thinking' && <TypingIndicator />}

          {state === 'listening' && (
            <View style={styles.recordingIndicator}>
              <WaveformBars />
              <Text style={styles.recordingText}>Ik luister...</Text>
            </View>
          )}
        </ScrollView>

        {/* Hint Bar */}
        <HintBar
          hint={hint}
          loading={hintLoading}
          onClose={() => setHint(null)}
        />

        {/* Bottom Input Area */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerHeader}>
              <Ionicons name="alert-circle" size={18} color={colors.coral} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={() => setErrorMessage(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.coral} />
              </TouchableOpacity>
            </View>
            {/permission|toegang tot de microfoon/i.test(errorMessage) && (
              <View style={styles.errorHelp}>
                <Text style={styles.errorHelpTitle}>How to fix on iPhone:</Text>
                <Text style={styles.errorHelpStep}>
                  1. Tap the <Text style={{ fontWeight: '700' }}>"AA"</Text> button in Safari's address bar
                </Text>
                <Text style={styles.errorHelpStep}>
                  2. Tap <Text style={{ fontWeight: '700' }}>"Website Settings"</Text>
                </Text>
                <Text style={styles.errorHelpStep}>
                  3. Set <Text style={{ fontWeight: '700' }}>Microphone</Text> to <Text style={{ fontWeight: '700' }}>Allow</Text>
                </Text>
                <Text style={styles.errorHelpStep}>
                  4. Reload this page and try again
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {needsAudioTap && (
            <TouchableOpacity style={styles.audioButton} onPress={handleEnableAudio}>
              <Text style={styles.audioButtonText}>Tik om geluid aan te zetten</Text>
            </TouchableOpacity>
          )}
          {showTextInput ? (
            <View style={styles.textInputRow}>
              <TouchableOpacity
                onPress={() => setShowTextInput(false)}
                style={styles.toggleMicButton}
              >
                <Ionicons name="mic" size={22} color={colors.deepTeal} />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                value={textInputValue}
                onChangeText={setTextInputValue}
                placeholder="Type in Spanish..."
                placeholderTextColor={colors.mediumGray}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={handleSendText}
              />
              <TouchableOpacity
                onPress={handleSendText}
                style={[
                  styles.sendButton,
                  !textInputValue.trim() && styles.sendButtonDisabled,
                ]}
                disabled={!textInputValue.trim()}
              >
                <Ionicons name="send" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.micArea}>
                <TouchableOpacity
                  onPress={() => setShowTextInput(true)}
                  style={styles.keyboardToggle}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={24}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.keyboardToggleText}>
                    Type
                  </Text>
                </TouchableOpacity>

                <MicButton
                  isRecording={sessionActive}
                  onPress={handleMicPress}
                  disabled={false}
                />

                <TouchableOpacity
                  onPress={handleHintRequest}
                  style={styles.keyboardToggle}
                  disabled={hintLoading}
                >
                  <Ionicons
                    name="bulb"
                    size={24}
                    color={hintLoading ? colors.mediumGray : colors.softOrange}
                  />
                  <Text style={[styles.keyboardToggleText, hintLoading && { color: colors.mediumGray }]}>
                    Hint
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Status text below mic */}
              <View style={styles.micStatusRow}>
                {state === 'connecting' ? (
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, styles.statusDotThinking]} />
                    <Text style={styles.statusPillText}>Verbinden...</Text>
                  </View>
                ) : state === 'listening' ? (
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, styles.statusDotSpeaking]} />
                    <Text style={styles.statusPillText}>Ik luister, praat maar</Text>
                  </View>
                ) : state === 'thinking' ? (
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, styles.statusDotThinking]} />
                    <Text style={styles.statusPillText}>Carlos denkt na...</Text>
                  </View>
                ) : state === 'speaking' ? (
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, styles.statusDotThinking]} />
                    <Text style={styles.statusPillText}>Carlos praat...</Text>
                  </View>
                ) : (
                  <Text style={styles.micHintCenterText}>
                    Tik op de microfoon om te praten
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Translate popup */}
      <TranslatePopup
        text={translateText}
        context={translateContext}
        onClose={() => {
          setTranslateText(null);
          setTranslateContext(undefined);
        }}
      />

      {/* Improve popup */}
      <ImprovePopup
        text={improveText}
        onClose={() => setImproveText(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.warmWhite,
  },
  flex: {
    flex: 1,
  },
  bubbleInterim: {
    opacity: 0.7,
  },
  audioButton: {
    backgroundColor: colors.softOrange,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  audioButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },

  // ── Top Bar ─────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderGray,
    backgroundColor: colors.white,
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.darkText,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timerText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  endSessionButton: {
    backgroundColor: colors.coral + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  endSessionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.coral,
  },

  // ── Messages ────────────────────────────────────────────
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageBubbleWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tutorBubbleWrapper: {
    alignItems: 'flex-start',
  },
  userBubbleWrapper: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderRadius: borderRadius.lg,
  },
  tutorBubble: {
    backgroundColor: colors.deepTeal,
    borderTopLeftRadius: borderRadius.sm / 2,
  },
  userBubble: {
    backgroundColor: colors.white,
    borderTopRightRadius: borderRadius.sm / 2,
    borderWidth: 1,
    borderColor: colors.borderGray,
  },
  messageText: {
    fontSize: typography.sizes.base,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  tutorMessageText: {
    color: colors.white,
  },
  userMessageText: {
    color: colors.darkText,
  },
  speakerButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  userActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.softOrange + '15',
  },
  userActionText: {
    fontSize: typography.sizes.xs,
    color: colors.softOrange,
    fontWeight: typography.weights.semibold,
  },
  scoreContainer: {
    marginTop: spacing.sm,
    alignItems: 'flex-end',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  scoreText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },

  // ── Typing Indicator ────────────────────────────────────
  typingContainer: {
    paddingHorizontal: spacing.md,
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.deepTeal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderTopLeftRadius: borderRadius.sm / 2,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  // ── Recording Indicator ─────────────────────────────────
  recordingIndicator: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  recordingText: {
    fontSize: typography.sizes.sm,
    color: colors.coral,
    fontWeight: typography.weights.semibold,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
  },
  waveformBar: {
    width: 4,
    height: 28,
    backgroundColor: colors.coral,
    borderRadius: 2,
  },

  // ── Error Banner ────────────────────────────────────────
  errorBanner: {
    backgroundColor: colors.coral + '15',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.coral + '40',
  },
  errorBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.coral,
    fontWeight: typography.weights.medium,
  },
  errorHelp: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.coral + '30',
    gap: 4,
  },
  errorHelpTitle: {
    fontSize: typography.sizes.xs,
    color: colors.coral,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  errorHelpStep: {
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    lineHeight: typography.sizes.sm * 1.4,
  },

  // ── Bottom Area ─────────────────────────────────────────
  bottomArea: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderGray,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  micArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  keyboardToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    gap: 2,
  },
  keyboardToggleText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  micAreaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  micHintText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  micStatusRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  micHintCenterText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.deepTeal + '0F',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.deepTeal + '20',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotListening: {
    backgroundColor: colors.successGreen,
  },
  statusDotSpeaking: {
    backgroundColor: colors.softOrange,
  },
  statusDotThinking: {
    backgroundColor: colors.deepTeal,
  },
  statusPillText: {
    fontSize: typography.sizes.sm,
    color: colors.darkText,
    fontWeight: typography.weights.medium,
  },

  // ── Text Input Mode ─────────────────────────────────────
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleMicButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.deepTeal + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md - 2 : spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.darkText,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
});
