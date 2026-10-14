// Bottom sheet primitives for the action / confirm / edit sheets. Built from the same tokens
// and pieces as the screens (ui-kit AnimatedPressable, InlineMessage, violet CTA gradient).
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui-kit';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const C = {
  backdrop: 'rgba(0,0,0,0.6)',
  surface: '#16161D',
  container: '#1F1F23',
  containerHigh: '#2A292E',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  violet: '#7C5CFF',
  violetEnd: '#B14CFF',
  warning: '#FF9F43',
  danger: '#EA5455',
} as const;

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={st.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[st.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={st.handle} />
          {title ? (
            <View style={st.head}>
              <View style={st.headCopy}>
                <Text style={st.title}>{title}</Text>
                {subtitle ? <Text style={st.sub}>{subtitle}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={st.close}>
                <MaterialIcons name="close" size={20} color={C.muted} />
              </Pressable>
            </View>
          ) : null}
          {scroll ? (
            <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={st.body}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetButton({
  label,
  icon,
  tone = 'default',
  onPress,
  disabled,
  loading,
}: {
  label: string;
  icon?: IconName;
  tone?: 'primary' | 'default' | 'danger';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const color = tone === 'danger' ? C.danger : C.text;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[st.btn, tone === 'default' && st.btnDefault, tone === 'danger' && st.btnDanger, (disabled || loading) && st.btnDisabled]}
    >
      {tone === 'primary' ? (
        <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {loading ? <ActivityIndicator color={color} /> : icon ? <MaterialIcons name={icon} size={18} color={color} /> : null}
      <Text style={[st.btnText, { color }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export function SheetRow({
  icon,
  iconColor = C.primary,
  label,
  sub,
  onPress,
  selected,
  disabled,
  tone,
  right,
}: {
  icon?: IconName;
  iconColor?: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  tone?: 'danger';
  right?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [st.row, selected && st.rowOn, pressed && st.pressed, disabled && st.btnDisabled]}
    >
      {icon ? <MaterialIcons name={icon} size={20} color={tone === 'danger' ? C.danger : iconColor} /> : null}
      <View style={st.rowCopy}>
        <Text style={[st.rowLabel, tone === 'danger' && { color: C.danger }]}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (selected ? <MaterialIcons name="check" size={18} color={C.primary} /> : null)}
    </Pressable>
  );
}

export function SheetCheck({
  label,
  sub,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [st.check, pressed && st.pressed, disabled && st.btnDisabled]}
    >
      <MaterialIcons name={checked ? 'check-box' : 'check-box-outline-blank'} size={22} color={checked ? C.primary : C.muted} />
      <View style={st.rowCopy}>
        <Text style={st.checkLabel}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export function SheetInput(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.muted} {...props} style={[st.input, props.multiline && st.multiline, props.style]} />;
}

export function SheetText({ children, tone }: { children: ReactNode; tone?: 'warning' | 'danger' }) {
  return <Text style={[st.text, tone === 'warning' && { color: C.warning }, tone === 'danger' && { color: C.danger }]}>{children}</Text>;
}

export function SheetLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={st.link}>
      {label}
    </Text>
  );
}

export function SheetLabel({ children }: { children: ReactNode }) {
  return <Text style={st.label}>{children}</Text>;
}

const st = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.backdrop },
  panel: {
    maxHeight: '88%',
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.border,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.containerHigh, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  headCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: C.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },
  sub: { color: C.muted, fontSize: 13, lineHeight: 18 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.container },
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 },

  btn: { height: 48, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnDefault: { backgroundColor: C.containerHigh },
  btnDanger: { backgroundColor: 'rgba(234,84,85,0.12)' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '600' },

  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: C.container, borderWidth: 1, borderColor: 'transparent' },
  rowOn: { borderColor: `${C.primaryContainer}88`, backgroundColor: `${C.primaryContainer}14` },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: C.text, fontSize: 15, fontWeight: '500' },
  rowSub: { color: C.muted, fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.8 },

  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkLabel: { color: C.text, fontSize: 14, fontWeight: '500' },

  input: { minHeight: 46, borderRadius: 12, backgroundColor: C.container, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 15 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  text: { color: C.muted, fontSize: 13, lineHeight: 18 },
  link: { color: C.primary, fontSize: 13, fontWeight: '600' },
  label: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
