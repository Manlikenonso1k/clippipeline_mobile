/* eslint-disable react-hooks/refs -- PanResponder handlers are created once and read gesture state from refs. */
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { StudioAsset } from '@/api/types';
import { C, secs } from './ui';

const H = 56;

/** Two-handle trim over the clip's thumbnail sprite. Values are source seconds. */
export function TrimBar({ asset, inSec, outSec, onChange }: { asset: StudioAsset; inSec: number; outSec: number; onChange: (inSec: number, outSec: number) => void }) {
  const duration = Math.max(0.5, asset.duration_seconds ?? outSec);
  'use no memo'; // PanResponder keeps gesture state in refs; opt this component out of the React Compiler.
  const [width, setWidth] = useState(0);
  const [range, setRange] = useState<[number, number]>([inSec, outSec]);
  const box = useRef({ width: 0, start: [inSec, outSec] as [number, number], live: [inSec, outSec] as [number, number], onChange });
  useEffect(() => {
    box.current.onChange = onChange;
  }, [onChange]);

  const pans = useRef(
    ([0, 1] as const).map((which) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          box.current.start = box.current.live;
        },
        onPanResponderMove: (_, g) => {
          const b = box.current;
          if (!b.width) return;
          const delta = (g.dx / b.width) * duration;
          const [x0, x1] = b.start;
          const next: [number, number] = which === 0 ? [Math.min(Math.max(0, x0 + delta), x1 - 0.5), x1] : [x0, Math.max(Math.min(duration, x1 + delta), x0 + 0.5)];
          b.live = next;
          setRange(next);
        },
        onPanResponderRelease: () => box.current.onChange(Number(box.current.live[0].toFixed(2)), Number(box.current.live[1].toFixed(2))),
      }),
    ),
  ).current;

  const t = asset.thumbs;
  const frames = t ? Math.min(t.count, Math.max(4, Math.floor(width / 44))) : 0;
  const scale = t ? H / t.height : 1;
  const x = (v: number) => (v / duration) * width;

  return (
    <View style={{ gap: 6 }}>
      <View style={st.bar} onLayout={(e: LayoutChangeEvent) => {
        box.current.width = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}>
        {t && asset.thumbs_url && width
          ? Array.from({ length: frames }, (_, i) => {
              const k = Math.min(t.count - 1, Math.floor((i / frames) * t.count));
              const col = k % t.cols;
              const row = Math.floor(k / t.cols);
              return (
                <View key={i} style={{ width: width / frames, height: H, overflow: 'hidden' }}>
                  <Image source={{ uri: asset.thumbs_url! }} style={{ width: t.cols * t.width * scale, height: t.rows * t.height * scale, marginLeft: -col * t.width * scale - (t.width * scale - width / frames) / 2, marginTop: -row * t.height * scale }} contentFit="fill" />
                </View>
              );
            })
          : null}
        {width ? (
          <>
            <View style={[st.dim, { left: 0, width: x(range[0]) }]} />
            <View style={[st.dim, { left: x(range[1]), right: 0 }]} />
            <View style={[st.window, { left: x(range[0]), width: Math.max(0, x(range[1]) - x(range[0])) }]} />
            <View {...pans[0].panHandlers} style={[st.handle, { left: x(range[0]) - 14 }]} accessibilityLabel="Trim start">
              <View style={st.grip} />
            </View>
            <View {...pans[1].panHandlers} style={[st.handle, { left: x(range[1]) - 14 }]} accessibilityLabel="Trim end">
              <View style={st.grip} />
            </View>
          </>
        ) : null}
      </View>
      <View style={st.labels}>
        <Text style={st.t}>In {secs(range[0])}</Text>
        <Text style={st.t}>{secs(range[1] - range[0])} kept</Text>
        <Text style={st.t}>Out {secs(range[1])}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { height: H, borderRadius: 10, overflow: 'hidden', backgroundColor: C.raised, flexDirection: 'row' },
  dim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  window: { position: 'absolute', top: 0, bottom: 0, borderWidth: 3, borderColor: C.primary, borderRadius: 8 },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 28, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 6, height: 28, borderRadius: 3, backgroundColor: '#fff' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  t: { color: C.muted, fontSize: 12, fontWeight: '600' },
});
