You are working in the ClipPipeline mobile app repo. Do NOT ask me questions. First detect the stack (Expo / React Native, or Capacitor / Ionic) and apply the matching approach below. Make the changes, test on a RELEASE build, commit and push. End with a short report.

1. APP IDENTITY (this project was cloned from my other app, Hospi Sales)
   - Display name must be exactly "ClipPipeline", not "clippipeline-mobile". Update every place it appears: app.json/app.config "name" (do NOT change the Expo slug or EAS project id), capacitor.config appName, android/app/src/main/res/values/strings.xml app_name, iOS Info.plist CFBundleDisplayName.
   - Remove every Hospi Sales asset: app icon, adaptive icon, splash screen, notification icon and favicon. Replace them with the ClipPipeline icons from assets/icons/.
   - CHECK the Android applicationId and iOS bundle identifier. If they match Hospi Sales, change them to com.nonsostudio.clippipeline. Otherwise installing one app replaces the other on the phone. Report what you found.
   - Generate all icon sizes from the 1024px sources. Android: adaptive icon with a foreground layer kept inside the safe zone, background #000000, plus a monochrome themed icon.

2. DYNAMIC APP ICON (3 states)
   - States: ACTIVE = icon-active.png (used recently), INACTIVE = icon-inactive.png (not opened for 24 hours), SLEEPING = icon-sleeping.png (not opened for 5 days).
   - Save a lastActiveAt timestamp every time the app comes to the foreground.
   - Android: declare 3 <activity-alias> entries (default ACTIVE) and switch between them with PackageManager.setComponentEnabledSetting(..., DONT_KILL_APP). Run the check in a WorkManager periodic job (every 6 hours) that reads lastActiveAt and switches the alias. Never switch the alias while the app is in the foreground, because some launchers close the app. Switch back to ACTIVE when the app goes to the background. Only switch if the state actually changed. If Expo, implement this as a local Expo module + config plugin (dev/production build, not Expo Go). If Capacitor, as a small native plugin.
   - iOS: keep the static ACTIVE icon. Register the alternate icons in Info.plist so they're ready, but do not call setAlternateIconName automatically (it only works in the foreground and shows a system alert). Leave a TODO note explaining why.
   - Add a hidden debug option in Profile to force each state so I can test it.

3. TAB BAR: CONSISTENCY (keep my current animation style, just make it consistent)
   - The tab bar (Home, Posts, Connect, Insights, Profile) must be rendered ONCE in a persistent layout, outside the screens. It must NOT be part of each page. If it currently mounts inside each page, that's why it feels like a website and re-animates on every switch. Fix it. Expo Router: app/(tabs)/\_layout.tsx with Tabs. React Navigation: a single bottom tab navigator. Capacitor/React web: one layout route with <Outlet/>, or IonTabs.
   - All 5 icons from ONE icon set, same size (24), same stroke weight, same style (outline when inactive, filled when active). Replace the Insights icon so it matches the others.
   - Equal-width tab items, fixed height, same label font size, single-line labels. The bar must never shift layout when switching.
   - Active state = color change + a small scale/bounce animation using transform and opacity ONLY (never width, height, padding or font size). Run animations on the UI thread (Reanimated on RN; CSS transform with will-change on web).
   - Light haptic feedback on tab press.

4. TAB SWITCHING: SMOOTH LIKE WHATSAPP
   - Keep visited tab screens mounted. Switching back must be instant with scroll position kept (no unmountOnBlur; on Capacitor, keep tab pages alive and toggle visibility instead of re-rendering routes).
   - Preload all 5 tabs shortly after the first screen renders.
   - Use cached data: TanStack Query (or the existing data layer) shows cached data instantly and refetches in the background. No full-screen loader on tab switch; use skeletons only on the very first load.
   - Defer heavy work until after the transition (InteractionManager.runAfterInteractions / startTransition).
   - Add swipe left/right between tabs using a native pager (react-native-pager-view on RN; a swiper with touch-action handling on Capacitor), synced with the tab bar.
   - Capacitor only: remove web feel. No tap highlight (-webkit-tap-highlight-color: transparent), no text selection on nav, overscroll-behavior: none, touch-action: manipulation, safe-area insets, no full page reloads or window.location navigation, and disable the Android WebView overscroll glow.
   - Memoize the tab bar and screen components so switching tabs doesn't re-render everything.

5. VERIFY
   - Build a RELEASE APK (dev mode is much slower and not a fair test) and test on a real mid-range Android phone.
   - Acceptance: tab press responds in under 100ms, about 60fps transitions, the nav bar never resizes, flickers or re-animates on its own, the app name shows "ClipPipeline", and no Hospi Sales asset remains (grep the repo for "hospi" and "spisales").
   - Report: what changed, the bundle id result, and how to test the icon states with the debug option.
