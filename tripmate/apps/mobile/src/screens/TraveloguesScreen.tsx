// Lists travelogues for a trip, plus a "create new" flow that picks from
// the trip's photos and POSTs to /trips/:id/travelogues. Vision call can
// take ~30s, so the UI shows a busy indicator and switches into the new
// row once the server responds.
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, Modal, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackParamList } from '../../App';

interface PhotoItem {
  id: string;
  signed_url: string;
  taken_at: string | null;
  caption: string | null;
}
interface PhotoGroup { date: string; items: PhotoItem[] }

interface TravelogueRow {
  id: string;
  status: 'running' | 'done' | 'error';
  created_at: string;
  photo_ids: string[];
  content: { intro: string } | null;
  error: string | null;
}

type Tone = 'casual' | 'literary' | 'concise';
const TONE_LABEL: Record<Tone, string> = { casual: '轻松', literary: '文艺', concise: '精炼' };

export default function TraveloguesScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Travelogues'>['route']>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { tripId } = route.params;

  const [items, setItems] = useState<TravelogueRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.get(`/trips/${tripId}/travelogues`)); }
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
        ListEmptyComponent={
          <Text style={s.empty}>
            还没有 AI 游记。{'\n'}选几张照片，让 AI 帮你写一篇。
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={s.card}
            disabled={item.status !== 'done'}
            onPress={() => nav.navigate('TravelogueDetail', { tripId, travelogueId: item.id })}
          >
            <View style={s.cardHead}>
              <Text style={s.cardDate}>{item.created_at.slice(0, 10)}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={s.cardSub}>
              {item.photo_ids.length} 张照片
            </Text>
            {item.content?.intro && (
              <Text style={s.cardIntro} numberOfLines={3}>{item.content.intro}</Text>
            )}
            {item.status === 'error' && (
              <Text style={s.cardError} numberOfLines={2}>错误：{item.error}</Text>
            )}
          </Pressable>
        )}
      />

      <View style={s.footer}>
        <Button title="生成新游记" onPress={() => setPickerOpen(true)} />
      </View>

      <PhotoPickerModal
        visible={pickerOpen}
        tripId={tripId}
        onClose={() => setPickerOpen(false)}
        onCreated={(row) => {
          setPickerOpen(false);
          // navigate straight into the new travelogue
          nav.navigate('TravelogueDetail', { tripId, travelogueId: row.id });
        }}
      />
    </View>
  );
}

function StatusBadge({ status }: { status: TravelogueRow['status'] }) {
  const map = {
    running: { label: '生成中...', color: colors.muted },
    done:    { label: '已完成',    color: colors.ok },
    error:   { label: '失败',      color: colors.danger },
  } as const;
  const { label, color } = map[status];
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// =========================================================================
// Picker modal: load photos, multi-select, choose tone, kick off generation
// =========================================================================
function PhotoPickerModal({
  visible, tripId, onClose, onCreated,
}: {
  visible: boolean; tripId: string;
  onClose: () => void;
  onCreated: (row: TravelogueRow) => void;
}) {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState<Tone>('casual');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // load only once when opened
  useFocusEffect(useCallback(() => {
    if (!visible) return;
    setLoading(true);
    api.get<{ groups: PhotoGroup[] }>(`/trips/${tripId}/photos`)
      .then((r) => setGroups(r.groups))
      .catch((e) => Alert.alert('加载照片失败', e.message))
      .finally(() => setLoading(false));
  }, [visible, tripId]));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= 40) return prev; // server cap
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return Alert.alert('请至少选 1 张照片');
    setBusy(true);
    try {
      const row = await api.post<TravelogueRow>(`/trips/${tripId}/travelogues`, {
        photo_ids: Array.from(selected),
        tone,
      });
      onCreated(row);
      setSelected(new Set());
    } catch (e: any) {
      Alert.alert('生成失败', e.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={s.modalHead}>
          <Pressable onPress={onClose} disabled={busy}>
            <Text style={{ color: colors.muted, fontSize: 15 }}>取消</Text>
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>选照片 ({selected.size}/40)</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.toneRow}>
          {(['casual', 'literary', 'concise'] as Tone[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTone(t)}
              style={[s.toneChip, tone === t && s.toneChipOn]}
            >
              <Text style={[s.toneText, tone === t && { color: '#fff' }]}>{TONE_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.l, paddingBottom: 120 }}>
            {groups.length === 0 && (
              <Text style={s.empty}>这次旅程还没有照片，先去相册上传。</Text>
            )}
            {groups.map((g) => (
              <View key={g.date} style={{ marginBottom: spacing.l }}>
                <Text style={s.modalDate}>{g.date}</Text>
                <View style={s.grid}>
                  {g.items.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <Pressable key={p.id} onPress={() => toggle(p.id)} style={s.thumbWrap}>
                        <Image source={{ uri: p.signed_url }} style={s.thumb} />
                        {on && (
                          <View style={s.thumbOverlay}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={s.modalFooter}>
          <Button
            title={busy ? '生成中（最长 30 秒）...' : `用 ${selected.size} 张生成游记`}
            onPress={submit}
            loading={busy}
            disabled={selected.size === 0 || busy}
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, padding: spacing.l, borderRadius: radius.md, gap: 6 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cardSub: { color: colors.muted, fontSize: 12 },
  cardIntro: { fontSize: 14, color: colors.text, lineHeight: 21, marginTop: 4 },
  cardError: { fontSize: 12, color: colors.danger, marginTop: 4 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl, lineHeight: 22 },
  footer: { padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },

  // modal
  modalHead: {
    paddingTop: 50, paddingHorizontal: spacing.l, paddingBottom: spacing.s,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  toneRow: { flexDirection: 'row', gap: 8, padding: spacing.l, paddingBottom: 0 },
  toneChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  toneChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toneText: { fontSize: 13, color: colors.text },
  modalDate: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumbWrap: { width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(79,109,245,.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalFooter: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
});
