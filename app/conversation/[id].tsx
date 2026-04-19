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
} from '@/src/services/ai';
import { startRecording, stopRecording, playAudio } from '@/src/services/speech';
import MicButton from '@/src/components/MicButton';
import CorrectionCard from '@/src/components/CorrectionCard';

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
    async (allMessages: Message[], allCorrections: Correction[]) => {
      setState('processing');

      const { response, corrections: newCorrections } = await generateTutorResponse(
        allMessages,
        scenario,
        'principiante'
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

      // Auto-play the tutor's response so the user hears it
      playAudio(response).catch(() => {
        // Silently ignore TTS errors
      });
    },
    [scenario]
  );

  const handleMicPress = useCallback(async () => {
    if (state === 'recording') {
      // Stop recording and process
      setState('processing');
      try {
        const transcribedText = await stopRecording();

        if (transcribedText && transcribedText.trim().length > 0) {
          setErrorMessage(null);
          const { score } = await generatePronunciationFeedback(transcribedText);

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
            addTutorResponse(updated, corrections);
            return updated;
          });
        } else {
          setErrorMessage('No speech detected. Try speaking louder.');
          setState('idle');
        }
      } catch (err: any) {
        console.error('[Conversation] Recording error:', err);
        setErrorMessage(err?.message || 'Recording failed. Please try again.');
        setState('idle');
      }
    } else if (state === 'idle') {
      // Start recording — user taps again to stop
      try {
        setErrorMessage(null);
        await startRecording();
        setState('recording');
      } catch (err: any) {
        console.error('[Conversation] Failed to start recording:', err);
        setErrorMessage(err?.message || 'Could not access microphone.');
      }
    }
  }, [state, userMessageCount, corrections, addTutorResponse]);

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
          <View
            style={[
              styles.messageBubble,
              isTutor ? styles.tutorBubble : styles.userBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isTutor ? styles.tutorMessageText : styles.userMessageText,
              ]}
            >
              {message.content}
            </Text>

            {isTutor && (
              <TouchableOpacity
                style={styles.speakerButton}
                onPress={() => handlePlayAudio(message.content)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="volume-medium-outline"
                  size={18}
                  color={colors.deepTealDark}
                />
              </TouchableOpacity>
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
          </View>
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

        {/* Bottom Input Area */}
        {errorMessage && (
          <TouchableOpacity
            onPress={() => setErrorMessage(null)}
            activeOpacity={0.8}
            style={styles.errorBanner}
          >
            <Ionicons name="alert-circle" size={18} color={colors.coral} />
            <Text style={styles.errorBannerText} numberOfLines={2}>
              {errorMessage}
            </Text>
            <Ionicons name="close" size={16} color={colors.coral} />
          </TouchableOpacity>
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
                <Text style={styles.keyboardToggleText}>Type</Text>
              </TouchableOpacity>

              <MicButton
                isRecording={state === 'recording'}
                onPress={handleMicPress}
                disabled={state === 'processing'}
              />

              <View style={styles.micAreaPlaceholder}>
                {state === 'recording' && (
                  <Text style={styles.micHintText}>Tap to stop</Text>
                )}
                {state === 'idle' && (
                  <Text style={styles.micHintText}>Tap to speak</Text>
                )}
                {state === 'processing' && (
                  <Text style={styles.micHintText}>Thinking...</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.coral + '15',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.coral + '40',
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.coral,
    fontWeight: typography.weights.medium,
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
