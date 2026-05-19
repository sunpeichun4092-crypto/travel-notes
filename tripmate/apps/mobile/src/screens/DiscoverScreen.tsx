// 5-step Wizard for "Discover destinations" — collects preferences and posts
// to /discoveries; navigates to results screen on success.
import { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import { toCents, type DiscoveryInputs } from '@tripmate/shared';
import type { RootStackParamList } from '../../App';

const STEPS = ['基地', '预算', '风格', '避雷与时间', '住宿与备注'] as const;

const STYLE_OPTIONS = ['美食', '深度文化', '徒步', '海岛', '摄影', '夜生活', '亲子', '小众'];
const LODGING_OPTIONS = [
  { v: 'hotel',    label: '酒店' },
  { v: 'hostel',   label: '青旅' },
  { v: 'homestay', label: '民宿' },
  { v: 'mixed',    label: '随便' },
] as const;

export default function DiscoverScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [base, setBase] = useState('');
  const [budgetMin, setBudgetMin] = useState('3000');
  const [budgetMax, setBudgetMax] = useState('8000');
  const [styles, setStyles] = useState<string[]>([]);
  const [avoid, setAvoid] = useState('');
  const [duration, setDuration] = useState('5');
  const [lodging, setLodging] = useState<DiscoveryInputs['lodging_pref']>('hotel');
  const [notes, setNotes] = useState('');

  function toggleStyle(x: string) {
    setStyles((arr) => arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  }

  async function submit() {
    if (!base.trim()) return Alert.alert('请填写出发基地');
    if (styles.length === 0) return Alert.alert('请选择至少一个风格');
    setSubmitting(true);
    try {
      const inputs: DiscoveryInputs = {
        base: base.trim(),
        budget_min_cents: toCents(parseFloat(budgetMin) || 0),
        budget_max_cents: toCents(parseFloat(budgetMax) || 0),
        styles,
        avoid: avoid.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean),
        duration_days: parseInt(duration, 10) || 5,
        lodging_pref: lodging,
        notes: notes.trim() || undefined,
      };
      const res = await api.post<{ id: string }>('/discoveries', inputs);
      nav.replace('DiscoverResults', { discoveryId: res.id });
    } catch (e: any) {
      Alert.alert('生成失败', e.message);
    } finally { setSubmitting(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.progress}>
        {STEPS.map((label, i) => (
          <View key={i} style={[s.dot, i <= step && s.dotOn]}>
            <Text style={[s.dotLabel, i <= step && { color: '#fff' }]}>{i + 1}</Text>
          </View>
        ))}
      </View>
      <Text style={s.stepName}>{STEPS[step]}</Text>

      <ScrollView contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}>
        {step === 0 && (
          <Field label="出发基地（城市）">
            <TextInput value={base} onChangeText={setBase} placeholder="例如：上海" style={s.input} />
          </Field>
        )}
        {step === 1 && (
          <View style={{ flexDirection: 'row', gap: spacing.m }}>
            <Field label="最低预算（元/人）" style={{ flex: 1 }}>
              <TextInput value={budgetMin} onChangeText={setBudgetMin} keyboardType="number-pad" style={s.input} />
            </Field>
            <Field label="最高预算（元/人）" style={{ flex: 1 }}>
              <TextInput value={budgetMax} onChangeText={setBudgetMax} keyboardType="number-pad" style={s.input} />
            </Field>
          </View>
        )}
        {step === 2 && (
          <Field label="想要的风格（多选）">
            <View style={s.chips}>
              {STYLE_OPTIONS.map((x) => (
                <Pressable key={x} onPress={() => toggleStyle(x)} style={[s.chip, styles.includes(x) && s.chipOn]}>
                  <Text style={[s.chipText, styles.includes(x) && { color: '#fff' }]}>{x}</Text>
                </Pressable>
              ))}
            </View>
          </Field>
        )}
        {step === 3 && (
          <>
            <Field label="避雷（用空格或逗号分隔）">
              <TextInput value={avoid} onChangeText={setAvoid} placeholder="人挤人 黑导游" style={s.input} />
            </Field>
            <Field label="天数">
              <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" style={s.input} />
            </Field>
          </>
        )}
        {step === 4 && (
          <>
            <Field label="住宿偏好">
              <View style={s.chips}>
                {LODGING_OPTIONS.map((x) => (
                  <Pressable key={x.v} onPress={() => setLodging(x.v)} style={[s.chip, lodging === x.v && s.chipOn]}>
                    <Text style={[s.chipText, lodging === x.v && { color: '#fff' }]}>{x.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="备注（可选）">
              <TextInput
                value={notes} onChangeText={setNotes} multiline
                placeholder="例如：希望小众、不想自驾、对辣食过敏..."
                style={[s.input, { minHeight: 90 }]}
              />
            </Field>
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step > 0 && <Button title="上一步" variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        {step < STEPS.length - 1 ? (
          <Button title="下一步" onPress={() => setStep(step + 1)} style={{ flex: 1 }} />
        ) : (
          <Button
            title={submitting ? '正在生成（10–20 秒）...' : '生成候选'}
            onPress={submit}
            loading={submitting}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
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
  progress: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.l, paddingTop: spacing.l },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.primary },
  dotLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  stepName: { textAlign: 'center', fontSize: 15, fontWeight: '600', marginTop: spacing.s, color: colors.text },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, backgroundColor: colors.card,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  footer: { flexDirection: 'row', gap: spacing.s, padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
