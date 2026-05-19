// Renders one travelogue's content { intro, days[], outro }, resolving
// each day's photo_ids back into signed URLs by joining against the trip's
// photo list. Polls every 4s while status is 'running'.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackParamList } from '../../App';

interface DayBlock { date: string; title: string; body: string; photo_ids: string[] }
interface Content { intro: string; days: DayBlock[]; outro: string }
interface Travelogue {
  id: string;
  status: 'running' | 'done' | 'error';
  content: Content | null;
  error: string | null;
  photo_ids: string[];
}
interface PhotoRow { id: string; signed_url: string }

export default function TravelogueDetailScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'TravelogueDetail'>['route']>();
  const { tripId, travelogueId } = route.params;
  const [t, setT] = useState<Travelogue | null>(null);
  const [photoMap, setPhotoMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [trav, photoResp] = await Promise.all([
        api.get<Travelogue>(`/trips/${tripId}/travelogues/${travelogueId}`),
        api.get<{ groups: { date: string; items: PhotoRow[] }[] }>(`/trips/${tripId}/photos`),
      ]);
      setT(trav);
      const m = new Map<string, string>();
      for (const g of photoResp.groups) for (const p of g.items) m.set(p.id, p.signed_url);
      setPhotoMap(m);
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tripId, travelogueId]);

  useEffect(() => { load(); }, [load]);

  // poll while still running
  useEffect(() => {
    if (t?.status === 'running') {
      pollRef.current = setTimeout(() => load(true), 4000);
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [t?.status, load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!t) return <View style={s.center}><Text>未找到游记</Text></View>;

  if (t.status === 'running') {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: spacing.s, color: colors.muted }}>AI 正在写作中...</Text>
        <Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>(每 4 秒自动刷新)</Text>
      </View>
    );
  }
  if (t.status === 'error' || !t.content) {
    return (
      <View style={s.center}>
        <Text style={{ color: colors.danger, marginBottom: 6 }}>生成失败</Text>
        <Text style={{ color: colors.muted, paddingHorizontal: spacing.l, textAlign: 'center' }}>
          {t.error ?? '未知错误'}
        </Text>
      </View>
    );
  }

  const { intro, days, outro } = t.content;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.l, gap: spacing.l, paddingBottom: spacing.xxl }}
    >
      <View style={s.section}>
        <Text style={s.label}>开篇</Text>
        <Text style={s.body}>{intro}</Text>
      </View>

      {days.map((d, i) => (
        <View key={i} style={s.section}>
          <View style={s.dayHead}>
            <Text style={s.dayDate}>{d.date}</Text>
            <Text style={s.dayNum}>Day {i + 1}</Text>
          </View>
          <Text style={s.dayTitle}>{d.title}</Text>
          <Text style={s.body}>{d.body}</Text>
          {d.photo_ids.length > 0 && (
            <View style={s.photoRow}>
              {d.photo_ids
                .map((pid) => photoMap.get(pid))
                .filter((u): u is string => !!u)
                .map((url, idx) => (
                  <Image key={idx} source={{ uri: url }} style={s.photo} />
                ))}
            </View>
          )}
        </View>
      ))}

      <View style={s.section}>
        <Text style={s.label}>结语</Text>
        <Text style={s.body}>{outro}</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  section: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md, gap: spacing.s },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  body: { fontSize: 15, lineHeight: 24, color: colors.text },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDate: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  dayNum: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  dayTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  photo: { width: '32%', aspectRatio: 1, borderRadius: 8 },
});
