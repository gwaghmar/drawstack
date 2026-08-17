# Agent-Native Universal Canvas Engine — Master Architecture & Plan

> **The Vision**: The world's first universal visual canvas designed from first principles for **frictionless human + AI co-editing**, **extreme token efficiency**, and **limitless expressive power** (flowcharts, system architectures, UI mockups, mindmaps, sticky ideation, freehand art, and data diagrams).

---

## 1. Product Thesis: Why Existing Canvas Engines Fail with AI

| Existing Canvas Engine | What It Does | Why It Fails with AI |
|---|---|---|
| **Mermaid / Graphviz** | Code/text to diagram | Zero human visual control; layout is purely automatic and rigid; cannot draw freeform shapes or wireframes. |
| **Excalidraw** | Human hand-drawn whiteboard | Verbose JSON (~25 properties per shape); AI regeneration wipes human spatial edits; high token cost. |
| **tldraw** | Infinite canvas | Commercial license blocks monetization; complex record-store architecture makes surgical AI patch editing brittle. |
| **Miro / Lucidchart** | Enterprise whiteboards | Proprietary closed ecosystems; no open JSON scene-graph diffing; fails with high object counts. |

### The Drawstack Breakthrough
1. **Surgical Co-Editing (`apply_ops`)**: Humans edit with mouse gestures; AI edits with id/name-addressed patch operations. Neither destroys the other's work.
2. **Extreme Token Efficiency (70%+ Reduction)**:
   - **Relative Placement Directives** (`place: { below: "api", gap: 40 }`): The model never needs to guess or calculate floating-point pixel coordinates.
   - **Palette Token Shorthands** (`"1"`–`"6"`, `"accent"`, `"muted"`): Cuts color token usage by 80%.
   - **Semantic Name Addressing** (`target: "auth-service"`): No hallucinated UUIDs.
   - **Compact Model Serialization**: One-line-per-shape format for prompt context injection.
3. **Universal Expressiveness**: One engine handles clean flowcharts, wireframes, cloud architectures, sticky notes, and freehand sketches.

---

## 2. Complete Visual Feature Matrix

### A. Shape Primitives
- **Rectangle** (`type: "rectangle"`, `cornerRadius?: number`)
- **Ellipse / Circle** (`type: "ellipse"`)
- **Diamond Polygon** (`type: "diamond"`) — 4-point polygon for decision gates and ERDs
- **Triangle** (`type: "triangle"`) — 3-point polygon for pyramids, delta nodes, hierarchies
- **Cylinder / Database** (`type: "cylinder"`) — 3D cylinder for storage & database architectures
- **Cloud** (`type: "cloud"`) — Multi-arc cloud for external services and network topologies
- **Hexagon & Star** (`type: "hexagon" | "star"`) — Process steps, badges, callouts
- **Sticky Note** (`type: "sticky"`) — Pastel note cards with shadow & auto-wrapping text
- **Text Block** (`type: "text"`) — Standalone headings, body text, annotations
- **Frame** (`type: "frame"`) — Spatial containers with auto-parenting of enclosed shapes
- **Freehand Path** (`type: "path"`) — Pressure-smooth freehand pen & brush strokes

### B. Styling & Formatting
- **Fills**: Palette shorthand (`"1"`–`"6"`), solid hex colors, transparent fill.
- **Borders & Strokes**: Custom stroke color, stroke widths (`1px`, `2px`, `4px`, `8px`), stroke patterns (`solid`, `dashed`, `dotted`).
- **Typography**: Font sizes (`10px`–`36px`), font families (`Inter`, `DM Mono`, `Caveat` handwritten), alignment (`left`, `center`, `right`), bold formatting.
- **Layers & Hierarchy**: `bringToFront`, `sendToBack`, `bringForward`, `sendBackward`.

### C. Connectors & Smart Routing
- **Routing Modes**:
  - `straight`: Direct point-to-point line.
  - `curved`: Smooth Bezier curve around obstacles.
  - `orthogonal`: Automatic 90-degree elbow step routing.
- **Endpoints & Anchors**: Dynamic shape binding (`top`, `right`, `bottom`, `left`, `center`, `auto`) with automatic position updates when shapes move.
- **Arrowheads**: Single arrow, double-headed arrow, plain line, and labeled connection text.

### D. Human Interaction Fundamentals (Konva)
- **Selection & Multi-Select**: Single click, Shift+click, Marquee drag-box.
- **Transform & Resize**: Rotate handles, corner/edge resize handles with aspect-ratio locking.
- **Snapping**: Smart vertical & horizontal magnetic alignment guides to nearby shape bounds and centers.
- **Keyboard Productivity**: `Ctrl+C` / `Ctrl+V` (Copy/Paste), `Ctrl+D` (Duplicate), `Backspace` (Delete), `Ctrl+Z` / `Ctrl+Shift+Z` (Undo/Redo), Arrow nudge (1px / Shift+10px).
- **Infinite Navigation**: Zoom (`Ctrl+Wheel` or pinch), Pan (`Space+Drag` or middle-click).

---

## 3. Agent-Native Engine Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CANVAS DOCUMENT                        │
│             { version: 1, shapes: CanvasShape[] }           │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │    HUMAN EDITING     │        │     AI CO-EDITING    │
    │  - Konva.Stage       │        │  - Intent Planner    │
    │  - Transformer       │        │  - Generation Prompt │
    │  - Gesture Refs      │        │  - apply_ops Engine  │
    │  - Floating Bar      │        │  - Compact Serializer│
    └──────────────────────┘        └──────────────────────┘
```

### The Ops Directives (Why AI generation is fast & cheap)

| Operation | Arguments | What It Accomplishes |
|---|---|---|
| `add` | `shape` | Adds a new shape with automatic defaults and auto-sizing. |
| `update` | `target`, `set` | Updates specific properties (color, text, size) without changing position. |
| `delete` | `target` | Deletes a shape, unparents frame children, and re-anchors connectors safely. |
| `connect` | `from`, `to`, `label`, `routing` | Connects two shapes by semantic name or id with labeled connector. |
| `place` | `target`, `below`/`rightOf`, `gap`, `align` | Positions a shape relative to another without needing absolute coordinates. |
| `layout` | `targets`, `arrange: "row"|"col"|"grid"`, `gap` | Auto-arranges a set of shapes in a clean grid or pipeline. |
| `reorder` | `target`, `to: "front"|"back"|"forward"|"backward"` | Adjusts visual z-index. |

---

## 4. Execution Roadmap

- [x] **Phase 1: Foundation (Milestones A–K)**
  - Schema, ops engine, serialization, Konva renderer, text editing, snapping, bound arrows, frames, sticky notes, AI generation, `apply_ops` agent tool, `tldraw` complete removal.
- [ ] **Phase 2: Universal Shape Library**
  - Real Diamond polygon, Triangle, Cylinder (Database), Cloud (Service/Network), Hexagon, Star.
- [ ] **Phase 3: Freehand Drawing Tool (`perfect-freehand`)**
  - Smooth pen tool mode on canvas (`mode: "draw"`), recording real-time vectors into `type: "path"`.
- [ ] **Phase 4: Floating Style & Formatting Toolbar**
  - Quick on-canvas toolbar for selected shapes: fill swatches, border styles, stroke widths, text typography, layer arrange.
- [ ] **Phase 5: Advanced Connector Routing**
  - Straight, Orthogonal Elbow, and Curved Bezier connector styles.
- [ ] **Phase 6: Productivity & Multi-Object Alignment**
  - Copy/Paste/Duplicate (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`) and multi-selection alignment tools (Align Left/Center/Right, Distribute).
