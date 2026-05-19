import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import { formatCents, type ExpenseWithShares } from '@tripmate/shared';
import type { RootStackParamList } from '../../App';

export default function ExpensesScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Expenses'>['route']>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tripId } = route.params;
  const [items, setItems] = useState<ExpenseWithShares[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.get(`/trips/${tripId}/expenses`)); }
    catch (e: any) { Alert.alert('加载失败', e.message); }
    finally { setRefreshing(false); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.wrap}>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={s.empty}>还没有账单。</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.title}>{item.description ?? '无说明'}</Text>
              <Text style={s.amount}>{formatCents(item.amount_cents, item.currency)}</Text>
            </View>
            <Text style={s.meta}>
              {item.split_mode === 'equal' ? '等额' : '加权'} · {item.shares.length} 人 · {item.spent_at.slice(0, 10)}
            </Text>
          </View>
        )}
      />
      <View style={s.footer}>
        <Button title="新增账单" onPress={() => nav.navigate('AddExpense', { tripId })} style={{ flex: 1 }} />
        <Button title="净额结算" variant="outline" onPress={() => nav.navigate('Settlement', { tripId })} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '600', flex: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.warn },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
  footer: { flexDirection: 'row', gap: spacing.s, padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
