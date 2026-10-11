import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const C = { bar: '#16161D', border: '#2A2A36', active: '#CABEFF', inactive: '#A1A1AE', dot: '#947DFF' } as const;

type TabDef = {
  name: string;
  label: string;
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
};

// One icon set (Ionicons), outline when inactive / filled when active, same size.
const TABS: TabDef[] = [
  { name: 'dashboard', label: 'Home', active: 'home', inactive: 'home-outline' },
  { name: 'posts', label: 'Posts', active: 'film', inactive: 'film-outline' },
  { name: 'connect', label: 'Connect', active: 'link', inactive: 'link-outline' },
  { name: 'insights', label: 'Insights', active: 'stats-chart', inactive: 'stats-chart-outline' },
  { name: 'profile', label: 'Profile', active: 'person', inactive: 'person-outline' },
];

function TabItem({ tab, focused, onPress }: { tab: TabDef; focused: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Active bounce — transform only, on the UI thread.
    if (focused) {
      scale.value = withSequence(withTiming(1.18, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 180 }));
    }
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = focused ? C.active : C.inactive;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? tab.active : tab.inactive} size={24} color={color} />
      </Animated.View>
      <Text numberOfLines={1} style={[styles.label, { color }]}>{tab.label}</Text>
      {focused ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        return (
          <TabItem
            key={route.key}
            tab={tab}
            focused={focused}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{ headerShown: false, lazy: false, animation: 'none' }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="posts" />
      <Tabs.Screen name="connect" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.bar, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  dot: { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.dot },
});
