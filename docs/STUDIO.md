# Studio (mobile)

Spec: `clippipeline/docs/STUDIO_SPEC.md` §12, contract `docs/CONTRACT.md` §17 (same commit pair as the backend).

| Route | Screen |
|---|---|
| `(tabs)/studio` | Projects list, usage, entry to the gallery (centre tab) |
| `studio/new` | Wizard: clips → reference → format → clean-up/captions → graphics, then create + upload |
| `studio/[id]` | Project: jobs (poll 3 s + push), auto-cut, undo, apply reference, timeline reorder/trim/split/speed/zoom/volume, template props, media, renders |
| `studio/templates` | Gallery: category counts, Popular/New, kind filter, pause previews, posters until tapped on mobile data, customize, add to project |
| `studio/render/[id]` | Play, save to gallery, share, cross-post (opens `post/new` with the render) |

- Hooks/types/demo: `src/api/{hooks,types,demo}.ts`; bundled gallery catalogue `src/api/studio/templates.json`
  (generated from `clippipeline/motion/dist/templates.json`) with posters/loops in `assets/studio/`.
- New native modules: `expo-media-library` (save, via `expo-media-library/legacy`), `expo-document-picker` (music),
  `expo-network` (Wi-Fi check). A dev/EAS build is required.
- APK: `.github/workflows/android-apk.yml` builds on every push to `feat/studio` and publishes a GitHub release.
  It is signed with the debug key, so uninstall an EAS-signed build first.
