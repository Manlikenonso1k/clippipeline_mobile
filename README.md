# ClipPipeline Mobile

ClipPipeline is an Expo and React Native mobile application for distributing creator clips across connected social platforms and tracking their performance.

## Project status

The repository includes the application foundation, API client and state layers, plus design references for the full creator workflow:

- Welcome and onboarding
- Dashboard and cross-platform insights
- Clip publishing and post details
- Social-account connection
- Profile and automation preferences

The current Expo Router implementation contains the starter routes while the remaining referenced product screens are available as design artifacts for implementation.

## Knowledge graph

The codebase has a Graphify map covering all 90 detected repository artifacts (35 code/config files, 23 documents/design references, and 32 image assets). Generated outputs are in [`graphify-out/`](./graphify-out/):

- [`graph.json`](./graphify-out/graph.json) — machine-readable graph
- [`GRAPH_REPORT.md`](./graphify-out/GRAPH_REPORT.md) — architecture report
- [`graph.html`](./graphify-out/graph.html) — interactive graph visualization

## Run locally

Install dependencies and start the Expo development server:

```bash
npm install
npx expo start
```

Useful commands:

```bash
npx expo lint
npx tsc --noEmit
npx expo start --android
npx expo start --ios
npx expo start --web
```

## Technology

- Expo SDK 57
- React Native and TypeScript
- Expo Router
- TanStack Query
- Zustand
- React Hook Form and Zod

## Repository layout

```text
src/app/          Expo Router screens and layouts
src/api/          API client, hooks, and types
src/components/   Reusable UI components
src/store/        Client and authentication state
src/lib/          Shared helpers
assets/           Application assets
* step */         Product design references
graphify-out/     Generated codebase knowledge graph
```
