import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import { useAuth } from '../store/auth';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !pw) return Alert.alert('请填写邮箱和密码');
    setLoading(true);
    try {
      if (mode === 'sign_in') await signInWithEmail(email.trim(), pw);
      else await signUpWithEmail(email.trim(), pw, name.trim() || undefined);
    } catch (e: any) {
      Alert.alert('出错了', e.message ?? '未知错误');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.container}
    >
      <Text style={s.brand}>🌊 TripMate</Text>
      <Text style={s.tagline}>3-8 人小团体出游伴侣</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>{mode === 'sign_in' ? '登录' : '注册'}</Text>
        {mode === 'sign_up' && (
          <TextInput
            placeholder="昵称（可选）"
            value={name} onChangeText={setName}
            style={s.input} autoCapitalize="none"
          />
        )}
        <TextInput
          placeholder="邮箱"
          value={email} onChangeText={setEmail}
          style={s.input} autoCapitalize="none" keyboardType="email-address"
        />
        <TextInput
          placeholder="密码"
          value={pw} onChangeText={setPw}
          style={s.input} secureTextEntry
        />
        <Button title={mode === 'sign_in' ? '登录' : '注册'} onPress={submit} loading={loading} />
        <Button
          title={mode === 'sign_in' ? '没有账号？去注册' : '已有账号？去登录'}
          variant="outline"
          onPress={() => setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}
          style={{ marginTop: 8 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.bg },
  brand: { fontSize: 36, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  tagline: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 32 },
  card: { backgroundColor: colors.card, padding: spacing.xl, borderRadius: radius.md, gap: spacing.m },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: spacing.s },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
  },
});
