import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, errorText } from '@/api/client';
import { useIsGuest, useStudioProjects, useStudioUsage } from '@/api/hooks';
import type { StudioProject } from '@/api/types';
import { C, Card, PrimaryButton, s as ui, secs } from '@/components/studio/ui';
import { AnimatedPressable, InlineMessage } from '@/components/ui-kit';
import { requireAccount } from '@/store/uiStore';

function ProjectCard({ p }: { p: StudioProject }) {
  const render = p.last_render;
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={`Open ${p.title}`} style={st.card} onPress={() => router.push({ pathname: '/studio/[id]', params: { id: String(p.id) } })}>
      <View style={st.thumb}>
        <LinearGradient colors={[C.violet, '#191926']} style={StyleSheet.absoluteFill} />
        {p.poster_url ? <Image source={{ uri: p.poster_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialIcons name="movie-filter" size={28} color="#fff" />}
        <View style={st.aspect}>
          <Text style={st.aspectText}>{p.aspect}</Text>
        </View>
      </View>
      <View style={ui.flex}>
        <Text style={ui.label} numberOfLines={1}>{p.title}</Text>
        <Text style={ui.muted} numberOfLines={1}>
          {p.clip_count} clip{p.clip_count === 1 ? '' : 's'} · {secs(p.duration_seconds)}
        </Text>
        <View style={st.statusRow}>
          <MaterialIcons name={render ? 'check-circle' : p.recipe && p.recipe.status !== 'failed' ? 'hourglass-top' : 'edit'} size={14} color={render ? C.success : C.muted} />
          <Text style={ui.mutedSmall}>
            {p.recipe && (p.recipe.status === 'waiting' || p.recipe.status === 'rendering') ? 'Making your video…' : render ? `${render.quality === 'final' ? 'Ready' : 'Preview rendered'}` : p.recipe?.status === 'failed' ? 'Needs another try' : 'Draft'}
          </Text>
          {p.has_style_profile ? <Text style={[ui.mutedSmall, { color: C.primary }]}>· Reference style</Text> : null}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={C.muted} />
    </AnimatedPressable>
  );
}

export default function StudioTab() {
  const guest = useIsGuest();
  const projects = useStudioProjects();
  const usage = useStudioUsage();
  const notOnServer = projects.error instanceof ApiError && (projects.error.status === 404 || projects.error.status === 503);
  const u = usage.data;

  const header = (
    <View style={{ gap: 16, marginBottom: 8 }}>
      <View style={st.titleRow}>
        <View style={ui.flex}>
          <Text style={st.title}>Studio</Text>
          <Text style={ui.muted}>Cut, style and add motion graphics. Every edit ends in an MP4.</Text>
        </View>
      </View>

      {guest ? (
        <Pressable onPress={() => requireAccount('Sign in to create Studio projects from your own clips.')}>
          <InlineMessage icon="lock-outline" text="Preview mode — these are sample projects. Sign in to edit your own clips." />
        </Pressable>
      ) : null}

      <PrimaryButton label="Make a video" icon="auto-awesome" onPress={() => (requireAccount('Sign in to make videos with Studio.') ? router.push('/studio/make') : undefined)} />
      <Text style={[ui.mutedSmall, { marginTop: -8 }]}>Upload, pick a style and music, and Studio edits it for you: cuts, captions, headlines, music, outro.</Text>
      <AnimatedPressable accessibilityRole="button" style={st.galleryLink} onPress={() => (requireAccount('Sign in to create a Studio project.') ? router.push('/studio/new') : undefined)}>
        <MaterialIcons name="tune" size={22} color={C.primary} />
        <View style={ui.flex}>
          <Text style={ui.label}>Advanced editor</Text>
          <Text style={ui.mutedSmall}>Several clips, a reference video, trim and place every template yourself</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={C.muted} />
      </AnimatedPressable>

      <AnimatedPressable accessibilityRole="button" style={st.galleryLink} onPress={() => router.push('/studio/templates')}>
        <LinearGradient colors={['rgba(124,92,255,0.22)', 'rgba(177,76,255,0.06)']} style={StyleSheet.absoluteFill} />
        <MaterialIcons name="auto-awesome" size={22} color={C.primary} />
        <View style={ui.flex}>
          <Text style={ui.label}>Motion graphics templates</Text>
          <Text style={ui.mutedSmall}>Titles, captions, lower thirds, charts, transitions</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={C.muted} />
      </AnimatedPressable>

      {u ? (
        <Card style={{ padding: 14, gap: 8 }}>
          <View style={st.usageRow}>
            <Text style={ui.mutedSmall}>Render minutes this month</Text>
            <Text style={ui.label}>
              {u.render_minutes_used.toFixed(1)}
              {u.render_minutes_limit != null ? ` / ${u.render_minutes_limit}` : ''}
            </Text>
          </View>
          {u.render_minutes_limit ? (
            <View style={ui.track}>
              <View style={[ui.fill, { width: `${Math.min(100, (u.render_minutes_used / u.render_minutes_limit) * 100)}%`, backgroundColor: C.violet }]} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {notOnServer ? <InlineMessage icon="cloud-off" text="Studio isn't switched on for your account's server yet. The template gallery still works." /> : null}
      {projects.isError && !notOnServer ? <InlineMessage icon="error-outline" text={errorText(projects.error)} /> : null}

      <Text style={ui.section}>Your projects</Text>
    </View>
  );

  return (
    <SafeAreaView style={ui.safe} edges={['top']}>
      <StatusBar style="light" />
      <FlatList
        data={notOnServer ? [] : projects.data ?? []}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <ProjectCard p={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          projects.isLoading ? null : (
            <View style={st.empty}>
              <MaterialIcons name="video-library" size={40} color={C.muted} />
              <Text style={ui.label}>No projects yet</Text>
              <Text style={[ui.muted, { textAlign: 'center' }]}>Pick a few clips, choose a style, and Studio cuts the silences and adds captions for you.</Text>
            </View>
          )
        }
        contentContainerStyle={ui.page}
        refreshControl={<RefreshControl tintColor={C.primary} refreshing={projects.isRefetching} onRefresh={() => !guest && projects.refetch()} />}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  title: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  thumb: { width: 64, height: 88, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  aspect: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(14,14,18,0.8)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  aspectText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  galleryLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
});
