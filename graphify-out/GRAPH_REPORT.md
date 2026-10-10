# Graph Report - clippipeline-mobile  (2026-10-10)

## Corpus Check
- 90 files · ~182,273 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 315 nodes · 355 edges · 88 communities (10 shown, 75 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87

## God Nodes (most connected - your core abstractions)
1. `expo` - 13 edges
2. `useTheme()` - 9 edges
3. `Connect Channels Screen` - 9 edges
4. `apiFetch()` - 8 edges
5. `ThemedText()` - 8 edges
6. `ThemedView()` - 8 edges
7. `scripts` - 7 edges
8. `Spacing` - 7 edges
9. `Insights Screen` - 7 edges
10. `adaptiveIcon` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Performance Area Chart` --semantically_similar_to--> `Cross-Channel Reach Chart`  [INFERRED] [semantically similar]
  dashboard step 5/code.html → insights step 8/code.html
- `Connect Channels Screen` --conceptually_related_to--> `ClipPipeline (App Brand)`  [INFERRED]
  connect step 7/code.html → get started step 4/code.html
- `ClipPipeline Mobile Agent Guide` --references--> `Kinetic Obsidian Design System (Connect)`  [INFERRED]
  AGENTS.md → connect step 7/DESIGN.md
- `ClipPipeline Mobile Agent Guide` --conceptually_related_to--> `Two-Project Build Blueprint`  [INFERRED]
  AGENTS.md → instructions.md
- `Expo App README` --conceptually_related_to--> `ClipPipeline Mobile Agent Guide`  [INFERRED]
  README.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Kinetic Obsidian Design System (shared across screens)** — connect_step_7_design_kinetic_obsidian, dashboard_step_5_design_kinetic_obsidian, get_started_step_4_design_kinetic_obsidian, insights_step_8_design_kinetic_obsidian [INFERRED 0.90]
- **Persistent Bottom Tab Navigation Shell** — connect_step_7_code_connectscreen, dashboard_step_5_code_dashboardscreen, insights_step_8_code_insightsscreen, dashboard_step_5_code_bottomnav [INFERRED 0.90]
- **Multi-Platform Syndication Pipeline (TikTok to YouTube/Instagram)** — get_started_step_4_code_clippipeline, connect_step_7_code_connectscreen, dashboard_step_5_code_dashboardscreen, insights_step_8_code_syndicationbanner [INFERRED 0.80]

## Communities (88 total, 75 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (27): styles, TabTwoScreen(), getDevMenuHint(), HomeScreen(), styles, styles, ExternalLink(), Props (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (27): ApiError, apiFetch(), API_BASE_URL, keys, useMe(), useOverview(), usePost(), usePosts() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (27): ClipPipeline Mobile Agent Guide, Connect Channels Screen, Instagram Connect Card, Pipeline Engine Rules Banner, TikTok Source Account Card, YouTube Target Destination Card, Kinetic Obsidian Design System (Connect), Bottom Tab Navigation Bar (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, reactCompiler, typedRoutes (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (14): queryClient, AnimatedIcon(), AnimatedSplashOverlay(), glowKeyframe, keyframe, logoKeyframe, styles, AppTabs() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (16): devDependencies, @types/react, typescript, main, name, private, scripts, android (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (12): ./assets/*, expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions, paths (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (9): expo, expo-splash-screen, expo-status-bar, expo-symbols, dependencies, expo, expo-splash-screen, expo-status-bar (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (4): glowKeyframe, keyframe, logoKeyframe, styles

## Knowledge Gaps
- **167 isolated node(s):** `stitch`, `name`, `slug`, `version`, `orientation` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 188 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **75 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `Community 3` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 7` to `Community 5`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Connect Channels Screen` (e.g. with `Kinetic Obsidian Design System (Connect)` and `Bottom Tab Navigation Bar`) actually correct?**
  _`Connect Channels Screen` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `stitch`, `name`, `slug` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12195121951219512 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08912655971479501 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08831908831908832 - nodes in this community are weakly interconnected._