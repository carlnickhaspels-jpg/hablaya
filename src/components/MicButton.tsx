import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/theme';

interface MicButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}

export default function MicButton({
  isRecording,
  onPress,
  disabled = false,
  size = 72,
}: MicButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.5,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.4,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.4);
    }
  }, [isRecording, pulseAnim, opacityAnim]);

  const handlePress = async () => {
    if (disabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics may not be available on all devices
    }
    onPress();
  };

  const ringSize = size + 32;
  const iconSize = size * 0.42;

  const buttonStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const ringStyle: ViewStyle = {
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      style={styles.container}
    >
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            ringStyle,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.button,
          buttonStyle,
          isRecording && styles.buttonRecording,
          disabled && styles.buttonDisabled,
        ]}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={iconSize}
          color={colors.white}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: colors.deepTeal,
  },
  button: {
    backgroundColor: colors.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.deepTealDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonRecording: {
    backgroundColor: colors.coral,
  },
  buttonDisabled: {
    backgroundColor: colors.mediumGray,
    shadowOpacity: 0,
    elevation: 0,
  },
});
