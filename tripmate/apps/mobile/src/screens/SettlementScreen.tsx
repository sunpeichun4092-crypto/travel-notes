import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { colors, radius, spacing } from '../lib/theme';
import { formatCents, type SettlementTransfer, type UserBalance } from '@tripmate/shared';
import type { RootStackParamList } from '../../App';

type ProfileMap = Record<string, string>;

export default function SettlementScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Settlement'>['route']>();
  const { tripId } = route.params;

  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [transfers, setTransfers] = useState<SettlementTransfer[]>([]);
  const [names, setNames] = useState<ProfileMap>({});
  const [currency, setCurrency] = useState('CNY');

  const load = useCallback(async () => {
    try {
      const trip: any = await api.get(`/trips/${tripId}`);
      const m: ProfileMap = {};
      for (const x of trip.trip_members ?? []) {
        m[x.user_id] = x.profiles?.display_name ?? '?';
      }
      setNames(m);
      setCurrency(trip.currency);

      const r = await api.get<{ balances: UserBalance[]; transfers: SettlementTransfer[] }>(
        `/trips/${tripId}/settlement`,
      );
      setBalances(r.balances);
      setTransfers(r.transfers);
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.wrap}>
      <Text style={s.section}>当前净额</Text>
      <FlatList
        data={balances}
        keyExtractor={(b) => b.user_id}
        contentContainerStyle={{ paddingHorizontal: spacing.l, gap: spacing.s }}
        ListEmptyComponent={<Text style={s.empty}>暂无账单。</Text>}
        renderItem={({ item }) => (
          <View style={s.balRow}>
            <Text style={s.name}>{names[item.user_id] ?? '?'}</Text>
            <Text style={[s.bal, item.balance_cents > 0 ? s.pos : item.balance_cents < 0 ? s.neg : s.zero]}>
              {item.balance_cents > 0 ? `应收 ${formatCents(item.balance_cents, currency)}`
                : item.balance_cents < 0 ? `应付 ${formatCents(-item.balance_cents, currency)}`
                : '已结清'}
            </Text>
          </View>
        )}
        scrollEnabled={false}
      />

      <Text style={s.section}>建议转账（最少笔数）</Text>
      {transfers.length === 0 ? (
        <Text style={s.empty}>无需任何转账。</Text>
      ) : (
        transfers.map((t, i) => (
          <View key={i} style={s.txRow}>
            <Text style={s.name}>{names[t.from] ?? '?'}</Text>
            <Text style={s.arrow}>→</Text>
            <Text style={s.name}>{names[t.to] ?? '?'}</Text>
            <Text style={s.txAmt}>{formatCents(t.amount_cents, currency)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.l },
  section: { fontSize: 13, color: colors.muted, marginHorizontal: spacing.l, marginVertical: spacing.s, textTransform: 'uppercase', letterSpacing: 1 },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, padding: spacing.m, borderRadius: radius.md },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.m, borderRadius: radius.md, marginHorizontal: spacing.l, marginBottom: spacing.s, gap: spacing.s },
  name: { fontSize: 14, fontWeight: '500', color: colors.text },
  arrow: { color: colors.muted },
  txAmt: { marginLeft: 'auto', fontWeight: '700', color: colors.warn },
  bal: { fontWeight: '600' },
  pos: { color: colors.ok },
  neg: { color: colors.danger },
  zero: { color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.l },
});
