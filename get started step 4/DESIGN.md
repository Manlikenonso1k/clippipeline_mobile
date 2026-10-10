---
name: Kinetic Obsidian
colors:
  surface: '#16161D'
  surface-dim: '#131317'
  surface-bright: '#39393d'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e7'
  on-surface-variant: '#c9c4d8'
  inverse-surface: '#e4e1e7'
  inverse-on-surface: '#303034'
  outline: '#938ea1'
  outline-variant: '#484555'
  surface-tint: '#cabeff'
  primary: '#cabeff'
  on-primary: '#31009a'
  primary-container: '#947dff'
  on-primary-container: '#2a0088'
  inverse-primary: '#603ce2'
  secondary: '#e1b6ff'
  on-secondary: '#4c007c'
  secondary-container: '#8401d2'
  on-secondary-container: '#e5bfff'
  tertiary: '#ffb780'
  on-tertiary: '#4e2600'
  tertiary-container: '#d7791f'
  on-tertiary-container: '#442000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#cabeff'
  on-primary-fixed: '#1c0062'
  on-primary-fixed-variant: '#4816cb'
  secondary-fixed: '#f2daff'
  secondary-fixed-dim: '#e1b6ff'
  on-secondary-fixed: '#2e004e'
  on-secondary-fixed-variant: '#6c00ae'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb780'
  on-tertiary-fixed: '#2f1400'
  on-tertiary-fixed-variant: '#6f3800'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
  surface-raised: '#1E1E28'
  border: '#2A2A36'
  text-primary: '#FFFFFF'
  text-secondary: '#A1A1AE'
  status-success: '#28C76F'
  status-warning: '#FF9F43'
  status-danger: '#EA5455'
  platform-tiktok-cyan: '#00F2EA'
  platform-tiktok-red: '#FE2C55'
  platform-youtube: '#FF0000'
  platform-instagram-start: '#F58529'
  platform-instagram-mid: '#DD2A7B'
  platform-instagram-end: '#8134AF'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  stat-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.03em
  stat-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

This design system expresses a high-velocity, modern dark aesthetic tailored specifically for mobile-native social creators and agile social teams. It blends the structural precision of high-end developer tooling with the vivid, atmospheric energy of contemporary creator platforms. The visual character communicates speed, precision, and multi-channel synchronization without visual clutter or toy-like decoration.

The overarching aesthetic unites **Dark-First Modernism** with **Atmospheric Luminescence**. Surfaces rely on deep, charcoal-tinted obsidian foundations rather than sterile pitch black, creating depth for layered cards and modals. Accent elements utilize radiant chromatic violet-to-fuchsia transitions, anchoring interactive workflows with high-contrast focal points. Precision borders, rich micro-surfaces, and crisp typography instill technical confidence, signaling reliability during automated syndication workflows.

## Colors

The palette is engineered exclusively for an immersive, contrast-rich dark environment. The foundational canvas uses an obsidian baseline (`#0B0B0F`), allowing mid-tone elevated surfaces (`#16161D` and `#1E1E28`) to delineate interactive groups without harsh divisions.

Key color roles and implementation principles:
- **Primary & Secondary Gradient Accent**: `#7C5CFF` flows linearly at a 135-degree angle toward `#B14CFF`. This visual gradient is reserved for key user actions (such as primary buttons, active bottom-navigation glyphs, and high-impact selection borders). It should not be diluted across ambient backgrounds.
- **Surface Elevation Hierarchy**: Base background (`#0B0B0F`) hosts cards and containment surfaces (`#16161D`). Floating controls, sheets, popovers, and pressed states adopt raised surfaces (`#1E1E28`).
- **Divider & Border Rules**: All container perimeters use `#2A2A36` at 1px thickness to anchor crisp boundaries in OLED conditions.
- **Status Indicators**: Operational states rely on dedicated semantic colors: `#28C76F` (Published / Success), `#FF9F43` (Processing / Pending), and `#EA5455` (Failed / Error). These are applied primarily to pill badge fills (with 15% opacity backgrounds) and iconography.
- **Platform Signatures**: Source and destination channels retain their exact identity signatures. TikTok uses either cyan `#00F2EA` or ruby `#FE2C55`; YouTube is anchored by crimson `#FF0000`; Instagram utilizes a diagonal linear gradient spanning `#F58529` through `#DD2A7B` to `#8134AF`. Platform colors only indicate identity and must not substitute for standard UI actions.

## Typography

The typography scale utilizes **Inter** across all functional roles to maximize technical readability, optical legibility on dark backdrops, and compact information density. 

Implementation requirements:
- **Tabular Figures**: All numerical metrics (`stat-xl`, `stat-lg`, follower counts, timestamps, and performance percentages) must explicitly enable OpenType tabular numbers (`tnum`) to eliminate layout jitter during live metric refreshes.
- **Hierarchy Weighting**: Structural screen titles use Display and `headline-lg` weights (700) with tightened letter tracking (-0.02em) to maintain visual impact on compact widths.
- **Contrast Coupling**: Primary titles, counts, and interactive inputs render in `#FFFFFF`. Secondary descriptions, metadata subheads, and inactive tabs use `#A1A1AE`. Pure white body copy is prohibited across paragraphs to avoid ocular fatigue against the `#0B0B0F` canvas.

## Layout & Spacing

The layout is built for native mobile screens using an **8pt progressive rhythm** combined with fluid-width full containers. 

Structural standards:
- **Canvas Margins & Gutters**: Fixed outer horizontal gutter and screen margins of `1rem` (16px) lock content cleanly within standard mobile viewport boundaries.
- **Card Padding**: Primary content cards utilize `space-lg` (20px) internal padding for primary dashboards, and `space-md` (16px) for nested lists and media tiles.
- **Vertical Rhythm**: Content modules and stacked cards maintain a consistent 12px or 16px gap (`space-md`). Section groups (e.g., separating summary KPI grids from activity feeds) utilize `1.5rem` (24px).
- **Touch Target Safeguards**: All interactive triggers, icon wrappers, and status switches must reserve a minimum hit-box boundary of 44x44px, irrespective of visible icon footprint.
- **Safe Area Anchors**: Top headers must pad dynamically against mobile status bars, and floating or fixed action buttons must account for mobile home indicator offsets.

## Elevation & Depth

Visual hierarchy is maintained through **tonal surface stacking** paired with **low-contrast micro-outlines** and subtle chromatic glows rather than heavy drop shadows:

- **Level 0 (Canvas Base)**: Deep canvas `#0B0B0F`. Non-interactive backdrop.
- **Level 1 (Card & Module Layer)**: Background `#16161D` bounded by a 1px solid `#2A2A36` border. This layer houses analytics blocks, horizontal posts, and media grids.
- **Level 2 (Raised Controls & Modals)**: Background `#1E1E28` bounded by a 1px solid `#373747` border. Used for bottom sheets, floating dialogs, interactive input fields, and flyouts. Shadow profile: `0 8px 24px -4px rgba(0, 0, 0, 0.45)`.
- **Level 3 (Accent Luminescence)**: Primary CTA buttons and selected items utilize a focused glow: `0 4px 20px 0 rgba(124, 92, 255, 0.35)`. Subtle, diffused radial gradients (`#7C5CFF` at 8% opacity with 80px blur) may be cast directly behind key metric heroes or visual branding moments.

## Shapes

The geometric identity relies on intentional curvature hierarchy to balance modern softness with structural precision:

- **Cards & Primary Modules**: Formed with an explicit 20px corner radius (`1.25rem`), producing friendly visual containers for mobile feeds and analytics blocks.
- **Form Inputs & Interactive Fields**: Set with a 12px corner radius (`0.75rem`), ensuring crisp input alignment distinct from primary outer cards.
- **Pills & Status Badges**: Formed using 9999px fully rounded caps (pill shape) to designate metadata tags, status pills, and categorical filter chips.
- **Media Previews**: Vertical clip thumbnails (9:16 aspect ratio) take a 12px corner radius to mirror the shape profile of mobile device viewports.

## Components

### Buttons
- **Primary Action**: Full-width or inline button featuring a 48px standard height, rounded to 12px. Fill uses the linear gradient from `#7C5CFF` to `#B14CFF` with bold `#FFFFFF` text. Employs a subtle violet drop glow. Pressed state transitions opacity to 0.85 and scales to 0.98.
- **Secondary / Surface**: Fill `#1E1E28`, border 1px solid `#2A2A36`, text `#FFFFFF`. Hover/pressed states shift the border to `#7C5CFF`.
- **Destructive Action**: Fill `rgba(234, 84, 85, 0.12)`, border 1px solid `rgba(234, 84, 85, 0.25)`, text `#EA5455`.

### Status Badges & Filter Chips
- **Status Pills**: Fully rounded pill capsules (height: 24px, horizontal padding: 10px). Background uses an alpha treatment (15% opacity) of the corresponding status color; label renders in the solid status color at `label-sm` weight:
  - *Published*: `rgba(40, 199, 111, 0.15)` fill with `#28C76F` text.
  - *Processing / Pending*: `rgba(255, 159, 67, 0.15)` fill with `#FF9F43` text.
  - *Failed*: `rgba(234, 84, 85, 0.15)` fill with `#EA5455` text.
- **Filter Chips**: Height 36px, fully rounded pill. Unselected state is `#16161D` with `#2A2A36` border and `#A1A1AE` label. Active state features `#7C5CFF` solid or gradient background with `#FFFFFF` label.

### Cards & Metric Tiles
- **Standard Card**: Radius 20px, fill `#16161D`, border 1px solid `#2A2A36`, internal padding 16px to 20px.
- **Stat Tile**: Houses a secondary label (`label-sm`, `#A1A1AE`), a bold headline metric (`stat-lg` or `stat-xl`, `#FFFFFF`), and an integrated trend indicator pill displaying growth percentages.
- **Selected Card**: When active or selected in a workflow, the card's border transitions from `#2A2A36` to a vivid 2px solid `#7C5CFF`, backed by a faint purple surface wash (`rgba(124, 92, 255, 0.05)`).

### Form Inputs
- **Text & Caption Fields**: Height 48px (or dynamic for multi-line captions), radius 12px, fill `#16161D`, border 1px solid `#2A2A36`, text `#FFFFFF`, placeholder text `#A1A1AE`. Focus state introduces a 1px border highlight in `#7C5CFF` with a subtle focus ring.

### Navigation & Tab Bar
- **Bottom Navigation Bar**: Fixed bar with surface `#16161D` and top border 1px solid `#2A2A36`. Minimal height of 64px plus safe-area margin. Icons are 24px clean line vectors. Inactive icons and labels render in `#A1A1AE`; the active item is illuminated in `#7C5CFF` with a micro-indicator dot below.

### Platform Identifiers
- Platform tags and integration cards feature dedicated brand iconography set against an elevated neutral surface (`#1E1E28`), bordered by the platform's signature tone: TikTok (source indicators), YouTube (crimson `#FF0000`), and Instagram (gradient badge).