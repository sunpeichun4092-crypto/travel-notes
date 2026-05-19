import { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackParamList } from '../../App';

export default function CreateTripScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [title, setTitle] = useState('');
  const [dest, setDest] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim()) return Alert.alert('请填写标题');
    setLoading(true);
    try {
      const trip = await api.post<{ id: string }>('/trips', {
        title: title.trim(),
        destination: dest.trim() || undefined,
        start_date: start || undefined,
        end_date: end || undefined,
      });
      nav.replace('TripDetail', { tripId: trip.id });
    } catch (e: any) {
      Alert.alert('创建失败', e.message);
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}>
      <Field label="标题">
        <TextInput value={title} onChangeText={setTitle} placeholder="例如：清迈 5 日小团游" style={s.input} />
      </Field>
      <Field label="目的地">
        <TextInput value={dest} onChangeText={setDest} placeholder="清迈、京都、巴厘岛..." style={s.input} />
      </Field>
      <View style={{ flexDirection: 'row', gap: spacing.m }}>
        <Field label="出发日期" style={{ flex: 1 }}>
          <TextInput value={start} onChangeText={setStart} placeholder="2026-06-10" style={s.input} />
        </Field>
        <Field label="返程日期" style={{ flex: 1 }}>
          <TextInput value={end} onChangeText={setEnd} placeholder="2026-06-14" style={s.input} />
        </Field>
      </View>
      <Text style={s.hint}>创建后你会成为旅程 owner，并自动获得一个 6 位邀请码可分享给伙伴。</Text>
      <Button title="创建旅程" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={style}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: colors.card,
  },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
