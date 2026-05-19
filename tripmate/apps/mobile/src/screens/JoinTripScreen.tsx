import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import { normalizeInviteCode } from '@tripmate/shared';
import type { RootStackParamList } from '../../App';

export default function JoinTripScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const c = normalizeInviteCode(code);
    if (c.length !== 6) return Alert.alert('邀请码格式不对', '应该是 6 位字母+数字');
    setLoading(true);
    try {
      const r = await api.post<{ trip_id: string }>('/trips/join', { invite_code: c });
      nav.replace('TripDetail', { tripId: r.trip_id });
    } catch (e: any) {
      Alert.alert('加入失败', e.message);
    } finally { setLoading(false); }
  }

  return (
    <View style={s.wrap}>
      <Text style={s.label}>邀请码</Text>
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
        placeholder="6 位字母+数字"
        style={s.input}
        maxLength={8}
      />
      <Text style={s.hint}>向朋友索要 6 位邀请码即可加入他们的旅程。</Text>
      <Button title="加入" onPress={submit} loading={loading} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: spacing.l, gap: spacing.m, backgroundColor: colors.bg, flex: 1 },
  label: { fontSize: 13, color: colors.muted },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 22, letterSpacing: 6,
    textAlign: 'center', backgroundColor: colors.card, fontWeight: '600',
  },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
