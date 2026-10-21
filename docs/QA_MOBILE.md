# Mobile QA finish

| Element | Page | Status | File:line |
|---|---|---|---|
| Clip video preview before publish (expo-video) | post/new | fixed | src/app/post/new.tsx (ClipPreview, rendered above Details) |
| Publish disabled when disclosure ON and neither brand option ticked | post/new | fixed | src/app/post/new.tsx (ttDisclosureIncomplete / publishBlocked, dock CTA) |
| creator_info, privacy dropdown, comment/Duet/Stitch logic | post/new | works (untouched) | src/app/post/new.tsx |
| Period label ("Last 7/30/90 days") by period switch | dashboard | fixed | src/app/(tabs)/dashboard.tsx (RANGE_LABEL, Performance caption) |
| Period label on Profile | profile | works: stat tiles already say "30d"; the export sheet has full labels. Tile text left alone (UI freeze, width) | src/app/(tabs)/profile.tsx:125 |
| Cross-Post Boost (A-07) | insights | works: WIP commit already excludes YouTube from the ratio and labels it an estimate. A-07 is not in PARITY.md by that id, so verified against the PROGRESS note only | src/app/(tabs)/insights.tsx (boostMult) |
| WIP QA edits (avatar images, failed+partial filter, billing URL) | tabs | verified; tsc clean | connect/insights/posts/dashboard |
| Dead-pattern sweep (empty onPress, TODO/FIXME, console.log, coming-soon) | tabs, post | works: none found | src/app/(tabs)/*, src/app/post/* |
| Logged-in never shows demo data | hooks | works: placeholderData is demo only without a token | src/api/hooks.ts:71-202 |

Gates: `npx tsc --noEmit` 0 errors; `npx expo lint` 0 errors (2 BOM warnings in untouched files).

Not finished: nothing blocked. The preview was not checked on a device (needs a dev build).
