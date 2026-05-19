import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Trip } from '@tripmate/shared';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../../App';

type TripWithMembers = Trip & {
  trip_members: { role: string; user_id: string }[];
};

export default function TripsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [trips, setTrips] = useState<TripWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAuth();

  const load = useCallback(async () => {
    try {
      setTrips(await api.get<TripWithMembers[]>('/trips'));
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.wrap}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={loading ? null : (
          <Text style={s.empty}>还没有旅程，点下方按钮新建一个或加入伙伴的旅程。</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={s.card}
            onPress={() => nav.navigate('TripDetail', { tripId: item.id })}
          >
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.meta}>
              {item.destination ?? '未指定'} · {item.start_date ?? '?'} → {item.end_date ?? '?'}
            </Text>
            <View style={s.row}>
              <Text style={s.code}>邀请码 {item.invite_code}</Text>
              <Text style={s.muted}>{item.trip_members?.length ?? 0} 人</Text>
            </View>
          </Pressable>
        )}
      />
      <View style={s.footer}>
        <Button title="新建旅程" onPress={() => nav.navigate('CreateTrip')} style={{ flex: 1 }} />
        <Button title="加入旅程" variant="outline" onPress={() => nav.navigate('JoinTrip')} style={{ flex: 1 }} />
        <Button title="退出" variant="outline" onPress={signOut} style={{ flex: 0.6 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md, gap: 4 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  code: { color: colors.primary, fontWeight: '500', fontSize: 13 },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl, lineHeight: 22 },
  footer: { flexDirection: 'row', gap: spacing.s, padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
