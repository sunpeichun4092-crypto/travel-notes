// Renders the candidates produced by /discoveries/:id. Shows niche/risk
// pills, pitch, local tips, and source links (with no fabricated URLs —
// the server already filtered to real search hits).
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackParamList } from '../../App';
import { useFocusEffect } from '@react-navigation/native';

interface SourceRef { title: string; url: string }
interface Candidate {
  id: string;
  rank: number;
  name: string;
  region: string | null;
  niche_level: number;
  risk_level: number;
  pitch: string;
  local_tips: string[];
  budget_hint: string | null;
  sources: SourceRef[];
}
interface Discovery {
  id: string;
  status: 'running' | 'done' | 'error';
  error: string | null;
  inputs: any;
  candidates: Candidate[];
}

export default function DiscoverResultsScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'DiscoverResults'>['route']>();
  const { discoveryId } = route.params;
  const [data, setData] = useState<Discovery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Discovery>(`/discoveries/${discoveryId}`);
      // sort candidates by rank ascending
      r.candidates = (r.candidates ?? []).slice().sort((a, b) => a.rank - b.rank);
      setData(r);
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [discoveryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator />
        <Text style={s.loadingText}>正在加载候选...</Text>
      </View>
    );
  }
  if (!data) return <View style={s.loadingWrap}><Text>未找到该推荐</Text></View>;

  if (data.status === 'error') {
    return (
      <View style={s.loadingWrap}>
        <Text style={{ color: colors.danger, marginBottom: 8 }}>生成失败</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.l }}>
          {data.error ?? '未知错误'}
        </Text>
      </View>
    );
  }
  if (data.status === 'running') {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator />
        <Text style={s.loadingText}>仍在生成中，下拉刷新</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.l, gap: spacing.m, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={s.summary}>
        基于你的偏好，{data.candidates.length} 个候选目的地：
      </Text>
      {data.candidates.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={s.headRow}>
            <Text style={s.rank}>#{c.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{c.name}</Text>
              {!!c.region && <Text style={s.region}>{c.region}</Text>}
            </View>
          </View>

          <View style={s.pillRow}>
            <Pill label={`小众度 ${c.niche_level}/5`} accent={c.niche_level >= 4 ? colors.primary : colors.muted} />
            <Pill label={`风险度 ${c.risk_level}/5`} accent={c.risk_level >= 4 ? colors.danger : c.risk_level >= 3 ? colors.warn : colors.ok} />
          </View>

          <Text style={s.pitch}>{c.pitch}</Text>

          {!!c.budget_hint && (
            <View style={s.budgetBox}>
              <Text style={s.budgetLabel}>预算参考</Text>
              <Text style={s.budgetText}>{c.budget_hint}</Text>
            </View>
          )}

          {c.local_tips.length > 0 && (
            <View style={s.tipsBox}>
              <Text style={s.tipsTitle}>当地人才知道</Text>
              {c.local_tips.map((t, i) => (
                <Text key={i} style={s.tip}>• {t}</Text>
              ))}
            </View>
          )}

          {c.sources.length > 0 && (
            <View style={s.sourcesBox}>
              <Text style={s.sourcesTitle}>参考链接</Text>
              {c.sources.map((src, i) => (
                <Text
                  key={i}
                  style={s.source}
                  onPress={() => Linking.openURL(src.url).catch(() => {})}
                  numberOfLines={2}
                >
                  [{i + 1}] {src.title}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function Pill({ label, accent }: { label: string; accent: string }) {
  return (
    <View style={[s.pill, { borderColor: accent }]}>
      <Text style={[s.pillText, { color: accent }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { marginTop: spacing.s, color: colors.muted },
  summary: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  card: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md, gap: spacing.s },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m },
  rank: { fontSize: 22, fontWeight: '800', color: colors.primary, minWidth: 40 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  region: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  pitch: { fontSize: 14, lineHeight: 22, color: colors.text },
  budgetBox: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.s, marginTop: 4 },
  budgetLabel: { fontSize: 11, color: colors.muted, marginBottom: 2, fontWeight: '600' },
  budgetText: { fontSize: 13, color: colors.text },
  tipsBox: { gap: 4, marginTop: 4 },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 },
  tip: { fontSize: 13, color: colors.text, lineHeight: 20 },
  sourcesBox: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.s, marginTop: 4, gap: 4 },
  sourcesTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 2 },
  source: { fontSize: 12, color: colors.primary, lineHeight: 18 },
});
