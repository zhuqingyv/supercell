# Visual Style Guide - Virtual Office

## 1. Overall Style: Q版像素风 (Chibi Pixel Art)

### Style Reference
- **Art direction**: 16-bit era chibi pixel art, inspired by Stardew Valley / Habitica / tiny office sims
- **Perspective**: Top-down 3/4 view (isometric-lite), consistent across all scenes
- **Mood**: Warm, playful, professional — a cozy office that feels alive

### Pixel Grid & Scale
| Element | Sprite Size | Display Scale |
|---------|------------|---------------|
| Character (idle) | 32x32 px | 2x-3x (64-96px on screen) |
| Character (with animation padding) | 48x48 px | 2x-3x |
| Desk / Furniture | 32x32 or 64x32 px | 2x |
| Floor tile | 16x16 px | 2x |
| UI icons | 16x16 px | 2x |
| Item / tool icons | 16x16 px | 2x |

### Character Proportions (Chibi)
- Head:body ratio = 1:1 (large head, small body)
- 3-head-tall maximum
- Limbs simplified, no finger detail at 32px
- Eyes are the primary expression vehicle: 2-4px dot or simple shapes
- Each character has a unique hair/accessory silhouette for instant recognition

---

## 2. Skeletal Animation Tools Research (Free / Open-Source)

### Recommended: DragonBones (Primary)

| Aspect | Details |
|--------|---------|
| License | Free (MIT for runtime) |
| Editor | DragonBones Pro (free desktop app, Windows/Mac) |
| Export | DragonBones JSON format, supports PixiJS runtime |
| Pixel art support | Good — disable anti-aliasing, use nearest-neighbor |
| Runtime | `pixi-dragonbones` or official PixiJS plugin |
| Pros | Mature, well-documented, strong Chinese community, direct PixiJS integration |
| Cons | Editor development has slowed, but stable for production |

### Alternative: Spine (Esoteric Software)

| Aspect | Details |
|--------|---------|
| License | Paid ($69+ personal), but runtime is open-source |
| Runtime | `pixi-spine` (official PixiJS plugin) |
| Pixel art | Excellent with nearest-neighbor filtering |
| Pros | Industry standard, best tooling, active development |
| Cons | Editor is not free |

### Alternative: Aseprite + Frame-based Animation

| Aspect | Details |
|--------|---------|
| License | $19.99 (or free if compiled from source, GPL) |
| Workflow | Export sprite sheets, use PixiJS AnimatedSprite |
| Pixel art | Purpose-built for pixel art, best pixel editing experience |
| Pros | Perfect pixel art workflow, onion skinning, palette management |
| Cons | No skeletal animation — frame-by-frame only |

### Recommended Approach
**Hybrid workflow**:
1. **Aseprite** for character part design and UI sprite creation (pixel-perfect editing)
2. **DragonBones** for skeletal animation rigging and export (free, PixiJS compatible)
3. **PixiJS** runtime with `pixi-dragonbones` plugin for in-app rendering

This gives us: free toolchain + pixel-perfect art + smooth skeletal animation + native PixiJS integration.

### Other Tools Evaluated (Not Recommended)
- **Synfig**: Vector-focused, not suited for pixel art
- **OpenToonz**: 2D frame animation, overkill for game sprites
- **Rive (Flare)**: Vector/motion design tool, not pixel-friendly
- **Krita**: Good painting tool but animation features are basic

---

## 3. Color Palette

### Primary Colors
```
Main Blue (brand/accent):    #4A90D9  — headers, active states, links
Dark Navy (text/bg):         #1A1A2E  — primary text, dark backgrounds
Warm White (background):     #F5F0E8  — main canvas, light areas
```

### Secondary Colors
```
Soft Green (online/success):  #5CB85C  — online status, success states
Amber Orange (busy/warning):  #F0AD4E  — busy status, warnings
Coral Red (offline/error):    #D9534F  — offline, errors, urgent
Soft Purple (design/creative):#9B59B6  — design role accent
Teal (development):           #1ABC9C  — dev role accent
```

### Status Colors (Employee States)

Aligned with UX state machine (DESIGN-states.md). Uses 5-tier color coding:

```
-- Green (active work) --
coding:       #5CB85C  — fast typing glow
designing:    #5CB85C  — sparkle particles
testing:      #5CB85C  — check/cross flash
writing:      #5CB85C  — slow typing glow
reviewing:    #5CB85C  — magnifier sweep

-- Blue (communication) --
meeting:      #4A90D9  — speech bubble pulse
chatting:     #4A90D9  — message bubble pop

-- Yellow (idle/standby) --
idle:         #F0C541  — gentle breathing shimmer

-- Orange (rest/background) --
break:        #F0AD4E  — coffee steam particles
memorizing:   #F0AD4E  — brain sparkle effect

-- Gray-Red (offline) --
offline:      #95A5A6  — desaturated, no animation
```

Status indicator dot uses the tier color. In the office scene, the character sprite's outline glow also tints to the tier color.

### Pixel Art Palette Rules
- Maximum 32 colors per character sprite (including shading)
- Each color has exactly 3 shades: highlight, base, shadow
- No gradients — use dithering patterns for transitions
- Black outlines (#1A1A2E) on all character sprites, 1px weight
- Background elements use softer outlines or no outlines

---

## 4. Typography

### Pixel Fonts (In-game UI)

| Use Case | Font | Size | Source |
|----------|------|------|--------|
| Character names | **Zpix** (最像素) | 12px | Free, CJK support |
| Status labels | **Zpix** | 10px | Free |
| Chat bubbles | **Fusion Pixel** | 12px | Free, CJK + Latin |
| Numbers/data | **Press Start 2P** | 8px | Google Fonts, free |

### System Fonts (Non-pixel UI panels)

| Use Case | Font | Fallback |
|----------|------|----------|
| Panel titles | Inter Semi-Bold | system-ui |
| Body text | Inter Regular | system-ui |
| Code snippets | JetBrains Mono | monospace |

### Font Rules
- Pixel fonts rendered at exact integer multiples (no sub-pixel)
- `image-rendering: pixelated` / `font-smooth: never` for pixel fonts
- Chinese text: Zpix or Fusion Pixel only (both have full CJK coverage)
- Minimum readable size: 8px (at 2x scale = 16px display)

---

## 5. Employee Character Design Spec

### Base Character Template
- **Canvas**: 48x48px (32x32 character + 16px padding for animations)
- **Skeleton bones**: head, torso, left_arm, right_arm, left_leg, right_leg, accessory_slot
- **Color slots**: skin, hair, shirt, pants, accessory (recolorable per character)
- **Unique identifiers**: hair style + accessory (hat/glasses/headphones/etc.)

### Role Visual Markers

| Role | Accessory | Desk Item | Color Accent |
|------|-----------|-----------|--------------|
| Leader/PM | Crown / tie | Whiteboard | Gold #F1C40F |
| Developer | Headphones | Dual monitors | Teal #1ABC9C |
| Designer | Beret / tablet pen | Drawing tablet | Purple #9B59B6 |
| Tester | Magnifying glass | Bug plush | Red #E74C3C |
| Architect | Hard hat (mini) | Blueprint scroll | Blue #3498DB |

### Animation States

Aligned with UX state machine (DESIGN-states.md). 12 states + transition animations.

#### Core State Animations

| State | Animation Description | Frames | Loop | DragonBones Name |
|-------|----------------------|--------|------|-----------------|
| `idle` | Sitting, gentle breathing, occasional glance left/right, blinking | 8 | yes | `idle` |
| `coding` | Fast typing, occasional head nod, eyes on screen | 12 | yes | `coding` |
| `designing` | Hand with pen/stylus, drawing gestures, sparkle particles | 10 | yes | `designing` |
| `testing` | Typing + occasional nod/head-shake (pass/fail) | 10 | yes | `testing` |
| `writing` | Slow typing, pause-think-type rhythm | 8 | yes | `writing` |
| `reviewing` | Staring at screen, occasional frown/nod, scroll gesture | 8 | yes | `reviewing` |
| `meeting` | Standing in meeting area, speech bubble toggle, arm gestures | 8 | yes | `meeting` |
| `chatting` | Slow typing (message pace), smile expression | 8 | yes | `chatting` |
| `break` | Stretch, drink coffee, stand up and walk near desk | 10 | yes | `break` |
| `memorizing` | Sitting still, brain-glow particle effect above head | 6 | yes | `memorizing` |
| `offline` | Empty chair pushed under desk (no character sprite) | 1 | no | `offline` |

#### Transition Animations (one-shot)

| Transition | Animation | Frames | DragonBones Name |
|-----------|-----------|--------|-----------------|
| `idle` -> any work state | Reach for keyboard, screen lights up | 6 | `trans_start_work` |
| any work -> `idle` | Push back from desk, relax posture | 6 | `trans_finish_work` |
| `idle` -> `meeting` | Stand up, walk to meeting area | 12 | `trans_go_meeting` |
| `meeting` -> `idle` | Walk back to desk, sit down | 12 | `trans_back_from_meeting` |
| any -> `break` | Push keyboard away, stretch arms | 8 | `trans_start_break` |
| any -> `offline` (fired) | Stand, pack items, walk to door, exit | 24 | `trans_leave` |
| `[new]` -> `idle` (hired) | Enter from door, walk to desk, sit down | 18 | `trans_arrive` |

#### Bubble Icons (above head, 16x16 px)

| State | Icon | Text |
|-------|------|------|
| `idle` | empty thought bubble | -- |
| `coding` | keyboard icon | "编码中" |
| `designing` | palette icon | "设计中" |
| `testing` | flask icon | "测试中" |
| `writing` | document icon | "编写中" |
| `reviewing` | magnifier icon | "审查中" |
| `meeting` | speech icon | "开会" |
| `chatting` | chat icon | "聊天中" |
| `break` | coffee icon | "休息" |
| `memorizing` | brain icon | "整理中" |

#### Desk Screen Effects

| State | Screen Content |
|-------|---------------|
| `idle` | Desktop wallpaper (static) |
| `coding` | Green character stream (Matrix-style) |
| `designing` | Colorful shapes / gradients |
| `testing` | Green checkmarks / red crosses flashing |
| `writing` | Document lines scrolling |
| `reviewing` | Code lines + red annotation marks |
| `meeting` | Screen dimmed (away from desk) |
| `chatting` | Chat bubbles UI |
| `break` | Screen saver / dimmed |
| `memorizing` | Notebook with sparkle overlay |
| `offline` | Black screen (powered off) |

### Animation Performance Rules
- Max 12 frames per animation loop (pixel art doesn't need more)
- Frame rate: 8 FPS for character animations (pixel art standard)
- Idle animations staggered (random start offset) to avoid sync across characters
- Only visible characters animate — off-screen sprites freeze

---

## 6. UI Component Pixel Style Spec

### General Rules
- All UI panels have a 2px pixel border (dark outline)
- Inner padding: 4px (pixel grid aligned)
- Corner style: square corners (no border-radius) OR 1px chamfered corners
- Drop shadows: 2px offset, 50% opacity dark color (pixel-perfect, no blur)
- All measurements snap to 2px grid

### Components

#### Button
```
┌──────────────────┐
│   Button Text    │  Height: 24px (at 2x: 48px)
└──────────────────┘  Border: 2px #1A1A2E
                      Background: #4A90D9 (primary) / #F5F0E8 (secondary)
States:               Hover: lighten 10%, 1px inset highlight
                      Active: darken 10%, 1px inset shadow
                      Disabled: desaturated, 50% opacity
```

#### Card (Employee Card — Slide-out Drawer)
```
┌────────────────────────┐
│  [Pixel Avatar 64x64]  │  Drawer width: 440px (desktop), 100% (mobile)
│                        │  Slide-in: 300ms ease-out from right
│  Name - Role           │  Border-left: 3px #1A1A2E
│  ● Status label        │  Background: #F5F0E8
│                        │  Backdrop: rgba(0,0,0,0.3)
│  [Bio section]         │  Close: click outside / Esc
│  [Current task + %]    │
│  [工作空间] [聊天记录]   │  Two CTA buttons, pixel style
│  [Recent activity log] │
└────────────────────────┘
```

#### Card (Employee Card — List View)
```
┌────────────────────────┐
│  [Avatar]  Name        │  Size: 160x200px (at 2x)
│           Role         │  Border: 2px #1A1A2E
│           Status ●     │  Background: #F5F0E8
│                        │  Avatar: 48x48 animated sprite
│  [Mini desk scene]     │  Click: navigate to workspace
└────────────────────────┘
```

#### Dialog / Modal
```
┌──────────────────────────┐
│ Title                  X │  Border: 3px #1A1A2E
│─────────────────────────│  Background: #F5F0E8
│                          │  Backdrop: 50% black overlay
│  Content area            │  Max width: 480px
│                          │  Animation: scale from 0.8 to 1.0
│  [Cancel]    [Confirm]   │  (pixel-snapped, no sub-pixel)
└──────────────────────────┘
```

#### Chat Bubble
```
    ┌─────────────────┐
    │ Message text... │    Border: 1px #1A1A2E
    └──┬──────────────┘    Self: #4A90D9 bg, white text
       ▼                   Other: #F5F0E8 bg, dark text
  [avatar]                 Max width: 280px
                           Pixel font, 12px Zpix
```

#### Input Field
```
┌──────────────────────────┐
│ Placeholder text...      │  Height: 28px
└──────────────────────────┘  Border: 2px #95A5A6 (idle)
                              Focus: border #4A90D9
                              Background: #FFFFFF
                              Font: Inter (system), not pixel
```

#### Status Indicator (5-tier)
```
● Active Work (#5CB85C green)   3x3px dot, steady glow pulse
● Communicating (#4A90D9 blue)  3x3px dot, gentle pulse
● Idle (#F0C541 yellow)         3x3px dot, static
● Rest/BG (#F0AD4E orange)      3x3px dot, slow fade in/out
● Offline (#95A5A6 gray)        3x3px dot, static, no animation
```
All dots render at 6x6px display (2x scale). Used in employee cards, list views, and office tooltips.

---

## 7. Scene Layout (Office Floor)

### Grid System
- Floor tiles: 16x16px base (32x32 display at 2x)
- Office area: 20x15 tiles minimum (640x480 base resolution)
- Each employee occupies a 3x3 tile desk area
- Walkways: 2 tiles wide between desk rows

### Desk Arrangement
```
 ┌─────────────────────────────────────┐
 │  [Leader]                           │
 │    ┌──┐                             │
 │    │PM│  Whiteboard area            │
 │    └──┘                             │
 │                                     │
 │  ┌──┐  ┌──┐  ┌──┐  ┌──┐           │
 │  │D1│  │D2│  │D3│  │D4│  Dev row   │
 │  └──┘  └──┘  └──┘  └──┘           │
 │                                     │
 │  ┌──┐  ┌──┐         ┌──┐          │
 │  │UX│  │VI│         │QA│           │
 │  └──┘  └──┘         └──┘          │
 │              Break area             │
 └─────────────────────────────────────┘
```

### Interaction Zones
- Click on character sprite -> open employee card
- Click on desk/computer -> open work chat view
- Click on whiteboard -> open project board
- Hover on character -> show name + status tooltip

---

## 8. Technical Integration Notes (for PixiJS)

### Rendering Setup
```
- PixiJS v8 with WebGPU/WebGL2 backend
- Scale mode: NEAREST (pixelated rendering, no smoothing)
- Base resolution: 640x480, scaled to fit viewport
- Sprite batching: use SpritesheetLoader for atlas packing
```

### DragonBones Integration
```
- Package: pixi-dragonbones (npm)
- Load sequence: texture atlas (.png) + skeleton data (.json) + animation data (.json)
- One DragonBones factory instance, shared across all characters
- Character pool: pre-instantiate up to 20 armatures
```

### Performance Budget
- Max simultaneous animated characters on screen: 15
- Target frame rate: 30 FPS (pixel art doesn't need 60)
- Texture atlas max size: 2048x2048 per sheet
- Total VRAM budget: < 64MB for all sprites/animations
