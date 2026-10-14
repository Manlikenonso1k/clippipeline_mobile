import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

/** Pressable with a subtle reanimated press-scale (default 0.97). */
export function AnimatedPressable({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        onPressOut?.(e);
      }}
      style={[style, aStyle]}
    />
  );
}

/** Wraps a bottom-tab icon; quick scale bounce whenever it becomes (or mounts) active. */
export function BounceIcon({ active, children }: { active: boolean; children: ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withSequence(withTiming(0.8, { duration: 80 }), withSpring(1, { damping: 7, stiffness: 240 }));
    } else {
      scale.value = withTiming(1, { duration: 120 });
    }
  }, [active, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Subtle pulsing placeholder block. */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t]);
  const aStyle = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.4 }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: '#2A292E' }, aStyle, style]} />;
}

/** Small on-brand inline message for error / empty states. */
export function InlineMessage({
  icon = 'info-outline',
  text,
  tone = 'muted',
  style,
}: {
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  text: string;
  tone?: 'muted' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const color = tone === 'danger' ? '#EA5455' : '#A1A1AE';
  return (
    <View style={[m.box, tone === 'danger' && m.boxDanger, style]}>
      <MaterialIcons name={icon} size={18} color={color} />
      <Text style={[m.text, { color }]}>{text}</Text>
    </View>
  );
}

/** Error state with a tap-to-retry affordance (InlineMessage in the danger tone). */
export function RetryMessage({
  text = "Couldn't load data — tap to retry",
  onRetry,
  style,
}: {
  text?: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onRetry} style={style}>
      <InlineMessage tone="danger" icon="refresh" text={text} />
    </Pressable>
  );
}

/** "Updated 5m ago" from an ISO time (U-05). */
export function updatedLabel(iso: string | null | undefined): string {
  if (!iso) return 'Not synced yet';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Not synced yet';
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 1) return 'Updated just now';
  if (min < 60) return `Updated ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Updated ${hr}h ago`;
  return `Updated ${Math.floor(hr / 24)}d ago`;
}

const m = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1F1F23',
  },
  boxDanger: { backgroundColor: 'rgba(234,84,85,0.10)' },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '500', flexShrink: 1, textAlign: 'center' },
});
