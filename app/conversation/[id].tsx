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
import {
  getInitialGreeting,
  generateTutorResponse,
  generatePronunciationFeedback,
  getSpanishHint,
} from '@/src/services/ai';
import {
  startRecording,
  stopRecording,
  playAudio,
  startConversation,
  stopConversation,
  pauseConversation,
  resumeConversation,
  TranscriptionResult,
} from '@/src/services/speech';
import MicButton from '@/src/components/MicButton';
import CorrectionCard from '@/src/components/CorrectionCard';
import TranslatePopup from '@/src/components/TranslatePopup';
import ImprovePopup from '@/src/components/ImprovePopup';
import HintBar from '@/src/components/HintBar';

type ConversationState = 'idle' | 'recording' | 'processing' | 'typing';

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

  const scenario = id && id !== 'free-talk' ? getScenarioById(id) : undefined;
  const screenTitle = scenario?.title ?? 'Free Talk';

  const [messages, setMessages] = useState<Message[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [state, setState] = useState<ConversationState>('idle');
  const [duration, setDuration] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tap-to-translate, improve, and hint UI state
  const [translateText, setTranslateText] = useState<string | null>(null);
  const [translateContext, setTranslateContext] = useState<string | undefined>(undefined);
  const [improveText, setImproveText] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Continuous conversation mode (always-listening)
  const [conversationMode, setConversationMode] = useState(false);
  const [vadLevel, setVadLevel] = useState(0);
  const [vadSpeaking, setVadSpeaking] = useState(false);
  const conversationModeRef = useRef(false);

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

  // Load initial tutor greeting
  useEffect(() => {
    const greeting = getInitialGreeting(scenario);
    const tutorMessage: Message = {
      id: generateId(),
      role: 'tutor',
      content: greeting,
      timestamp: new Date().toISOString(),
    };
    setMessages([tutorMessage]);

    // Auto-play greeting so user hears it
    playAudio(greeting).catch(() => {
      // Silently ignore (autoplay may be blocked until user interacts)
    });
  }, [scenario]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages, state]);

  const addTutorResponse = useCallback(
    async (
      allMessages: Message[],
      allCorrections: Correction[],
      meta?: { uncertainSegments?: string[]; detectedLanguage?: string }
    ) => {
      setState('processing');

      // Pause VAD while AI thinks/speaks so it doesn't pick up its own voice
      if (conversationModeRef.current) pauseConversation();

      const { response, corrections: newCorrections } = await generateTutorResponse(
        allMessages,
        scenario,
        'principiante',
        meta
      );

      const tutorMessage: Message = {
        id: generateId(),
        role: 'tutor',
        content: response,
        timestamp: new Date().toISOString(),
      };

      if (newCorrections.length > 0) {
        const lastUserMsg = [...allMessages].reverse().find((m) => m.role === 'user');
        if (lastUserMsg) {
          const existing = correctionsByMessageId.current.get(lastUserMsg.id) ?? [];
          correctionsByMessageId.current.set(lastUserMsg.id, [
            ...existing,
            ...newCorrections,
          ]);
        }
        setCorrections((prev) => [...prev, ...newCorrections]);
      }

      setMessages((prev) => [...prev, tutorMessage]);
      setState('idle');

      // Auto-play the tutor's response so the user hears it,
      // then resume listening when done
      try {
        await playAudio(response);
      } catch {
        // ignore TTS errors
      }

      if (conversationModeRef.current) {
        // Longer delay after TTS so any audio echo settles before resuming.
        // The VAD service also enforces a higher threshold for ~1.5s after
        // resume to ignore residual TTS echo.
        setTimeout(() => resumeConversation(), 800);
      }
    },
    [scenario]
  );

  // Handle a transcribed user utterance from VAD
  const handleUserUtterance = useCallback(
    async (result: TranscriptionResult) => {
      const transcribedText = result.text?.trim();
      if (!transcribedText) return;
      setErrorMessage(null);

      // Use Whisper confidence for pronunciation score:
      // fewer uncertain segments = better pronunciation
      const baseScore = 80;
      const penalty = (result.uncertainSegments?.length || 0) * 8;
      const score = Math.max(50, Math.min(95, baseScore - penalty));

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: transcribedText,
        timestamp: new Date().toISOString(),
        pronunciationScore: score,
      };

      setUserMessageCount((prev) => prev + 1);
      setMessages((prev) => {
        const updated = [...prev, userMessage];
        addTutorResponse(updated, corrections, {
          uncertainSegments: result.uncertainSegments,
          detectedLanguage: result.detectedLanguage,
        });
        return updated;
      });
    },
    [corrections, addTutorResponse]
  );

  const handleStartConversationMode = useCallback(async () => {
    try {
      setErrorMessage(null);
      conversationModeRef.current = true;
      setConversationMode(true);

      // Debounce speech-start UI: don't show "Hearing you..." for sub-300ms
      // false positives that would otherwise flicker.
      let speakingDebounce: ReturnType<typeof setTimeout> | null = null;

      await startConversation({
        onSpeechStart: () => {
          if (speakingDebounce) clearTimeout(speakingDebounce);
          speakingDebounce = setTimeout(() => {
            setVadSpeaking(true);
            setState('recording');
            speakingDebounce = null;
          }, 250);
        },
        onSpeechEnd: () => {
          if (speakingDebounce) {
            clearTimeout(speakingDebounce);
            speakingDebounce = null;
            // Speech was too brief — don't transition to processing,
            // stay in 'idle' / 'Listening' state
            return;
          }
          setVadSpeaking(false);
          setState('processing');
        },
        onTranscript: (text) => {
          handleUserUtterance(text);
        },
        onLevel: (level) => {
          setVadLevel(level);
        },
        onError: (err) => {
          setErrorMessage(err.message);
          conversationModeRef.current = false;
          setConversationMode(false);
          setState('idle');
        },
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not start conversation mode.');
      conversationModeRef.current = false;
      setConversationMode(false);
    }
  }, [handleUserUtterance]);

  const handleStopConversationMode = useCallback(async () => {
    conversationModeRef.current = false;
    setConversationMode(false);
    setVadSpeaking(false);
    setVadLevel(0);
    await stopConversation();
    setState('idle');
  }, []);

  const handleMicPress = useCallback(async () => {
    if (conversationMode) {
      await handleStopConversationMode();
    } else {
      await handleStartConversationMode();
    }
  }, [conversationMode, handleStartConversationMode, handleStopConversationMode]);

  // Cleanup conversation mode on unmount
  useEffect(() => {
    return () => {
      if (conversationModeRef.current) {
        stopConversation();
      }
    };
  }, []);

  const handleSendText = useCallback(() => {
    const text = textInputValue.trim();
    if (!text || state !== 'idle') return;

    Keyboard.dismiss();

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      pronunciationScore: Math.floor(Math.random() * 36) + 60,
    };

    setTextInputValue('');
    setUserMessageCount((prev) => prev + 1);

    setMessages((prev) => {
      const updated = [...prev, userMessage];
      addTutorResponse(updated, corrections);
      return updated;
    });
  }, [textInputValue, state, corrections, addTutorResponse]);

  const handlePlayAudio = useCallback((text: string) => {
    playAudio(text);
  }, []);

  const handleHintRequest = useCallback(async () => {
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
  }, [messages, scenario]);

  const handleWordTap = useCallback((word: string, fullMessage: string) => {
    // Strip punctuation
    const cleaned = word.replace(/[.,!?;:¡¿"'()]/g, '').trim();
    if (!cleaned) return;
    setTranslateContext(fullMessage);
    setTranslateText(cleaned);
  }, []);

  const handleMessageLongPress = useCallback((fullMessage: string) => {
    setTranslateContext(undefined);
    setTranslateText(fullMessage);
  }, []);

  const handleImproveMessage = useCallback((text: string) => {
    setImproveText(text);
  }, []);

  const handleEndSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    router.push({
      pathname: '/conversation/summary',
      params: {
        messagesJson: JSON.stringify(messages),
        correctionsJson: JSON.stringify(corrections),
        duration: duration.toString(),
        scenarioId: id ?? 'free-talk',
      },
    });
  }, [router, messages, corrections, duration, id]);

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

          {state === 'processing' && <TypingIndicator />}

          {state === 'recording' && (
            <View style={styles.recordingIndicator}>
              <WaveformBars />
              <Text style={styles.recordingText}>Listening...</Text>
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
            {errorMessage.toLowerCase().includes('permission') && (
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
                editable={state === 'idle'}
              />
              <TouchableOpacity
                onPress={handleSendText}
                style={[
                  styles.sendButton,
                  (!textInputValue.trim() || state !== 'idle') &&
                    styles.sendButtonDisabled,
                ]}
                disabled={!textInputValue.trim() || state !== 'idle'}
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
                  disabled={conversationMode}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={24}
                    color={conversationMode ? colors.mediumGray : colors.textSecondary}
                  />
                  <Text style={[styles.keyboardToggleText, conversationMode && { color: colors.mediumGray }]}>
                    Type
                  </Text>
                </TouchableOpacity>

                <MicButton
                  isRecording={conversationMode || state === 'recording'}
                  onPress={handleMicPress}
                />

                <TouchableOpacity
                  onPress={handleHintRequest}
                  style={styles.keyboardToggle}
                  disabled={hintLoading || conversationMode}
                >
                  <Ionicons
                    name="bulb"
                    size={24}
                    color={hintLoading || conversationMode ? colors.mediumGray : colors.softOrange}
                  />
                  <Text style={[styles.keyboardToggleText, (hintLoading || conversationMode) && { color: colors.mediumGray }]}>
                    Hint
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Status text below mic */}
              <View style={styles.micStatusRow}>
                {conversationMode ? (
                  <View style={styles.statusPill}>
                    <View style={[
                      styles.statusDot,
                      vadSpeaking ? styles.statusDotSpeaking
                        : state === 'processing' ? styles.statusDotThinking
                        : styles.statusDotListening,
                    ]} />
                    <Text style={styles.statusPillText}>
                      {vadSpeaking ? 'Hearing you...'
                        : state === 'processing' ? 'AI is thinking...'
                        : 'Listening — just speak'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.micHintCenterText}>
                    Tap to start speaking
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
