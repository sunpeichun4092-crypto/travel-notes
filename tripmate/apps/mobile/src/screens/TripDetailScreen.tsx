import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Trip } from '@tripmate/shared';
import { api } from '../api/client';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackParamList } from '../../App';

type Detail = Trip & {
  trip_members: { role: string; user_id: string; profiles: { display_name: string | null; avatar_url: string | null } }[];
};

export default function TripDetailScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'TripDetail'>['route']>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Detail | null>(null);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { setTrip(await api.get(`/trips/${tripId}`)); }
    catch (e: any) { Alert.alert('加载失败', e.message); }
    finally { setRefresh(false); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!trip) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const days = countdownDays(trip.start_date);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
    >
      <View style={s.header}>
        <Text style={s.title}>{trip.title}</Text>
        <Text style={s.meta}>{trip.destination ?? '未指定'}</Text>
        <Text style={s.meta}>{trip.start_date ?? '?'} → {trip.end_date ?? '?'}</Text>
        {days !== null && (
          <View style={s.countdown}>
            <Text style={s.countdownLabel}>距出发</Text>
            <Text style={s.countdownValue}>{days >= 0 ? `${days} 天` : `已结束`}</Text>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>邀请码</Text>
        <Text style={s.code}>{trip.invite_code}</Text>
        <Text style={s.hint}>分享给伙伴，他们打开 App → 加入旅程 → 输入此码即可加入。</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>成员（{trip.trip_members.length}）</Text>
        <View style={{ gap: 6 }}>
          {trip.trip_members.map((m) => (
            <Text key={m.user_id} style={s.member}>
              {m.profiles?.display_name ?? '?'} {m.role === 'owner' && '· 队长'}
            </Text>
          ))}
        </View>
      </View>

      <View style={s.tiles}>
        <Tile color="#f59e0b" emoji="💰" title="团队记账" subtitle="谁付的、谁该还" onPress={() => nav.navigate('Expenses', { tripId })} />
        <Tile color="#ec4899" emoji="📸" title="共享相册" subtitle="按拍摄日期归档" onPress={() => nav.navigate('Album', { tripId })} />
        <Tile color="#4f6df5" emoji="🧭" title="发现目的地" subtitle="GPT + 网页搜索" onPress={() => nav.navigate('Discover', { tripId })} />
        <Tile color="#8b5cf6" emoji="✈️" title="AI 游记" subtitle="多图自动整理成游记" onPress={() => nav.navigate('Travelogues', { tripId })} />
      </View>
    </ScrollView>
  );
}

function Tile({ color, emoji, title, subtitle, onPress }: { color: string; emoji: string; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={[s.tile, { borderTopColor: color }]} onPress={onPress}>
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileSub}>{subtitle}</Text>
    </Pressable>
  );
}

function countdownDays(start?: string | null): number | null {
  if (!start) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(start + 'T00:00:00'); if (isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md, gap: 4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, fontSize: 13 },
  countdown: {
    marginTop: spacing.s, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: spacing.s,
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  countdownLabel: { color: '#fff', fontSize: 12, opacity: 0.9 },
  countdownValue: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md, gap: 6 },
  cardTitle: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  code: { fontSize: 30, fontWeight: '700', letterSpacing: 6, color: colors.primary, textAlign: 'center', paddingVertical: spacing.s },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  member: { fontSize: 14, color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  tile: {
    flex: 1, minWidth: '45%', backgroundColor: colors.card, padding: spacing.l,
    borderRadius: radius.md, borderTopWidth: 4, gap: 4,
  },
  tileTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 6 },
  tileSub: { fontSize: 12, color: colors.muted },
});
