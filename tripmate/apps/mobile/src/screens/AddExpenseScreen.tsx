import { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import { toCents } from '@tripmate/shared';
import type { RootStackParamList } from '../../App';

interface Member {
  user_id: string;
  profiles: { display_name: string | null };
}

export default function AddExpenseScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'AddExpense'>['route']>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tripId } = route.params;

  const [members, setMembers] = useState<Member[]>([]);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState<'equal' | 'weighted'>('equal');
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ trip_members: Member[] }>(`/trips/${tripId}`).then((trip) => {
      setMembers(trip.trip_members ?? []);
      const inc: Record<string, boolean> = {};
      const w: Record<string, string> = {};
      for (const m of trip.trip_members ?? []) {
        inc[m.user_id] = true; w[m.user_id] = '1';
      }
      setIncluded(inc); setWeights(w);
      if (!payerId && trip.trip_members?.[0]) setPayerId(trip.trip_members[0].user_id);
    }).catch((e) => Alert.alert('加载成员失败', e.message));
  }, [tripId]);

  async function submit() {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return Alert.alert('金额无效');
    if (!payerId) return Alert.alert('请选择付款人');
    const participants = members
      .filter((m) => included[m.user_id])
      .map((m) => ({
        user_id: m.user_id,
        weight: mode === 'weighted' ? parseInt(weights[m.user_id] || '1', 10) : undefined,
      }));
    if (participants.length === 0) return Alert.alert('至少选择一位参与者');

    setLoading(true);
    try {
      await api.post(`/trips/${tripId}/expenses`, {
        payer_id: payerId,
        amount_cents: toCents(amt),
        description: desc.trim() || undefined,
        split_mode: mode,
        participants,
      });
      nav.goBack();
    } catch (e: any) {
      Alert.alert('保存失败', e.message);
    } finally { setLoading(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}>
      <Field label="金额（元）">
        <TextInput
          value={amount} onChangeText={setAmount}
          placeholder="0.00" keyboardType="decimal-pad" style={s.input}
        />
      </Field>
      <Field label="说明">
        <TextInput value={desc} onChangeText={setDesc} placeholder="例如：晚饭" style={s.input} />
      </Field>

      <Text style={s.sectionTitle}>付款人</Text>
      <View style={s.chips}>
        {members.map((m) => (
          <Chip
            key={m.user_id}
            active={payerId === m.user_id}
            label={m.profiles?.display_name ?? '?'}
            onPress={() => setPayerId(m.user_id)}
          />
        ))}
      </View>

      <Text style={s.sectionTitle}>分账方式</Text>
      <View style={s.chips}>
        <Chip active={mode === 'equal'}    label="等额" onPress={() => setMode('equal')} />
        <Chip active={mode === 'weighted'} label="加权" onPress={() => setMode('weighted')} />
      </View>

      <Text style={s.sectionTitle}>参与者</Text>
      {members.map((m) => (
        <View key={m.user_id} style={s.memberRow}>
          <Pressable
            style={[s.checkbox, included[m.user_id] && s.checkboxOn]}
            onPress={() => setIncluded({ ...included, [m.user_id]: !included[m.user_id] })}
          />
          <Text style={s.memberName}>{m.profiles?.display_name ?? '?'}</Text>
          {mode === 'weighted' && included[m.user_id] && (
            <TextInput
              keyboardType="number-pad"
              value={weights[m.user_id]}
              onChangeText={(v) => setWeights({ ...weights, [m.user_id]: v })}
              style={s.weightInput}
            />
          )}
        </View>
      ))}

      <Button title="保存账单" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<View><Text style={s.label}>{label}</Text>{children}</View>);
}

const s = StyleSheet.create({
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: colors.card,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  memberName: { flex: 1, fontSize: 15, color: colors.text },
  weightInput: { width: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, textAlign: 'center', backgroundColor: colors.card },
});
