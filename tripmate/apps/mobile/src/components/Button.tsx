import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

interface Props {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}
export default function Button({ title, onPress, loading, variant = 'primary', disabled, style }: Props) {
  const bg = variant === 'primary' ? colors.primary
           : variant === 'danger'  ? colors.danger
           : 'transparent';
  const fg = variant === 'outline' ? colors.primary : '#fff';
  const borderColor = variant === 'outline' ? colors.primary : bg;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.txt, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { fontSize: 15, fontWeight: '600' },
});
