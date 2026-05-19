import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';
import Button from '../components/Button';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackParamList } from '../../App';

interface PhotoItem {
  id: string;
  signed_url: string;
  taken_at: string | null;
  like_count: number;
  liked_by_me: boolean;
  caption: string | null;
}
interface PhotoGroup { date: string; items: PhotoItem[]; }

export default function AlbumScreen() {
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Album'>['route']>();
  const { tripId } = route.params;
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ groups: PhotoGroup[] }>(`/trips/${tripId}/photos`);
      setGroups(r.groups);
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    } finally { setRefreshing(false); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要相册权限');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      exif: true,
      selectionLimit: 20,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      // 1. ask backend for signed upload URLs
      const filesPayload = result.assets.map((a) => {
        const ext = (a.uri.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4);
        return {
          ext,
          width: a.width, height: a.height,
          taken_at: a.exif?.DateTimeOriginal
            ? exifDateToISO(a.exif.DateTimeOriginal as string)
            : undefined,
        };
      });
      const sign = await api.post<{
        uploads: { photo_id: string; storage_path: string; signed_url: string; token: string }[];
      }>(`/trips/${tripId}/photos/sign-upload`, { files: filesPayload });

      // 2. upload each binary directly to Supabase Storage
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const up = sign.uploads[i];
        const blob = await (await fetch(asset.uri)).blob();
        const r = await fetch(up.signed_url, { method: 'PUT', body: blob });
        if (!r.ok) throw new Error(`upload failed ${r.status}`);
      }

      // 3. register rows
      const rowsBody = sign.uploads.map((up, i) => ({
        photo_id: up.photo_id,
        storage_path: up.storage_path,
        taken_at: filesPayload[i].taken_at ?? null,
        width: filesPayload[i].width,
        height: filesPayload[i].height,
      }));
      await api.post(`/trips/${tripId}/photos`, { photos: rowsBody });
      await load();
    } catch (e: any) {
      Alert.alert('上传失败', e.message);
    } finally { setUploading(false); }
  }

  async function toggleLike(p: PhotoItem) {
    const next = !p.liked_by_me;
    setGroups((g) => g.map((grp) => ({
      ...grp,
      items: grp.items.map((x) => x.id === p.id
        ? { ...x, liked_by_me: next, like_count: x.like_count + (next ? 1 : -1) }
        : x),
    })));
    try {
      if (next) await api.post(`/trips/${tripId}/photos/${p.id}/like`);
      else await api.delete(`/trips/${tripId}/photos/${p.id}/like`);
    } catch { load(); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.l, gap: spacing.l }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {groups.length === 0 && <Text style={s.empty}>还没有照片，从下方上传 →</Text>}
        {groups.map((g) => (
          <View key={g.date}>
            <Text style={s.date}>{g.date}</Text>
            <View style={s.grid}>
              {g.items.map((p) => (
                <Pressable key={p.id} style={s.thumbWrap} onLongPress={() => toggleLike(p)} onPress={() => toggleLike(p)}>
                  <Image source={{ uri: p.signed_url }} style={s.thumb} />
                  <View style={s.likePill}>
                    <Text style={{ color: '#fff', fontSize: 11 }}>
                      {p.liked_by_me ? '❤️' : '🤍'} {p.like_count}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={s.footer}>
        <Button title={uploading ? '上传中...' : '从相册选择上传'} onPress={pickAndUpload} loading={uploading} />
      </View>
    </View>
  );
}

// EXIF "YYYY:MM:DD HH:MM:SS" → ISO
function exifDateToISO(s: string): string | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

const s = StyleSheet.create({
  date: { color: colors.muted, fontSize: 12, marginBottom: 6, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumbWrap: { width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  likePill: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
  footer: { padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
