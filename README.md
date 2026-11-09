# Twelve O'Clock — Dirtbike Wheelie & Stunt Simulator

**Twelve O'Clock** is a 60fps physics-based 2D dirtbike wheelie and stunt simulator built with React, TypeScript, Tailwind CSS, and HTML5 Canvas, featuring a procedural Web Audio 2-stroke/4-stroke engine synthesizer.

Loft the front wheel into the balance-point sweet spot, feather the rear brake to prevent looping out, pull in the clutch to rev-bomb and dump it in higher gears, chase 1st through 6th gear mid-wheelie, and drag the titanium tail block for 4× spark multipliers.

---

## Core Physics & Gameplay Mechanics

- **Rotational Balance-Point Physics**:
  - Gravity pulls the front end down when below the balance point (`~55°–81°`) and tips the bike backward toward a loop-out once past it (`>82°`).
  - Rider weight shift (`A` / `D`) dynamically moves the center of mass across the seat and footpegs.
- **Rear-Brake Feathering (`S` / `↓`)**:
  - Tapping or feathering the rear brake applies counter-torque around the rear axle to save over-rotated wheelies before looping out (`92°–95°`), heating up the rear brake rotor.
- **Hold & Dump Clutch Lever (`C` / `Shift`)**:
  - Holding the clutch disengages the engine from the rear tire, eliminating engine braking so you can coast smoothly at 12 o'clock or rev-bomb the engine to redline (`0%–100%` clutch bite charge).
  - Releasing the clutch dumps stored flywheel momentum into the rear knobby tire for an instant wheelie kick in any gear.
- **6-Speed Sequential Gearbox (`Q` / `E` + `AUTO` / `MANUAL` Toggle)**:
  - Shift down (`Q` / `GEAR −`) or shift up (`E` / `GEAR +`) across 6 gears.
  - Shifting up while balanced in a wheelie awards a **Gear Chase Wheelie Shift** bonus and lets you carry high-speed wheelies without bouncing off the rev limiter.
- **Titanium 12 O'Clock Tail Scrapes & Stunt Poses**:
  - Holding the bike in the `81°–92°` scrape window drags the rear fender titanium skid block on the ground, showering sparks and awarding a **4× Scrape Multiplier**.
  - Trigger mid-wheelie stunts (`Space` or `1` / `2` / `3`): *No-Hander Salute*, *High-Chair Seat Stand*, and *Whip Nac-Nac*.
- **Procedural Web Audio Engine Synthesizer**:
  - Zero external audio files required—synthesizes 2-stroke and 4-stroke exhaust notes, rev-limiter flutter, clutch snaps, gearshift clunks, brake rotor hiss, suspension bottoming thuds, and titanium spark grinds in real time.

---

## Controls

| Action | Keyboard | On-Screen HUD Pedal |
| :--- | :--- | :--- |
| **Throttle / Lift Front Wheel** | `W` or `↑` | `THROTTLE [W]` |
| **Rear Brake (Save Loop-Out)** | `S` or `↓` | `REAR BRAKE [S]` |
| **Lean Rider Back / Forward** | `A` / `D` or `←` / `→` | `← LEAN [A]` / `LEAN [D] →` |
| **Hold Clutch / Release to Dump** | `C` or `Shift` | `HOLD CLUTCH [C]` |
| **Shift Gear Down / Up** | `Q` / `E` | `GEAR − [Q]` / `GEAR + [E]` |
| **Quick Clutch Pop / Stunt Trick** | `Space` (or `1`, `2`, `3`) | `QUICK POP` / `STUNT TRICK` |
| **Open Bikes & Maps Menu** | `B` or `Tab` | `BIKES & MAPS [B]` |
| **Pause / Resume** | `Esc` | `PAUSE` |
| **Mute / Unmute Audio** | `M` | `SOUND` / `MUTE` |

---

## Machines & Maps

### 5 Playable Dirtbikes
1. **KTM-X 250 Six Days (`250cc · 2-Stroke`)**: Snappy 2-stroke powerband with a featherweight front end and wide `56°–81°` balance window.
2. **Apex CRF 450 Rally (`450cc · 4-Stroke`)**: High-torque desert thumper that pulls the front wheel up across deep silt beds.
3. **YZ-125 Twelve-Spec (`125cc · 2-Stroke`)**: Stunt-geared 58-tooth sprocket, high rear-brake authority, and forgiving `95°` loop-out limit.
4. **KX-500 Desert Outlaw (`500cc · 2-Stroke`)**: Open-class two-stroke beast capable of 152 km/h 5th- and 6th-gear power wheelies.
5. **SM-700 Street Stunt (`690cc · 4-Stroke`)**: Supermoto stunt build with dual-caliper rear handbrake and extended titanium tail cage.

### 5 Terrain Courses
1. **Baja Sunset Mesa**: Golden-hour Sonoran desert rollers with long sightlines.
2. **Slickrock Canyon Run**: Technical Utah sandstone ledges, kicker ramps, and canyon updraft gusts.
3. **Floodlight Stunt Compound**: High-grip night stadium stunt lot built for deep 12 o'clock tail scrapes.
4. **Timberline MX National**: High-altitude Colorado motocross track with rhythm whoops and tabletops.
5. **Imperial Sand Dunes**: Wide-open Glamis sand bowls built for high-gear clutch-dump wheelies.

---

## Project Structure

```text
├── src/
│   ├── components/
│   │   ├── GameCanvas.tsx    # Isolated 60fps HTML5 Canvas loop & keyboard/touch input handler
│   │   ├── GameHUD.tsx       # Low-occlusion perimeter HUD, SVG angle protractor & stunt pedals
│   │   └── GameModals.tsx    # Title screen, Bikes & Maps Garage menu, Pause & Wipeout modals
│   ├── game/
│   │   ├── audio.ts          # Procedural Web Audio 2-stroke/4-stroke synth & sound effects
│   │   ├── renderer.ts       # Multi-layer parallax, terrain, bike suspension & IK rider renderer
│   │   ├── simulation.ts     # 60fps rotational wheelie physics, 6-speed gearbox, clutch & particles
│   │   └── types.ts          # Bike configs, Course configs & Telemetry types
│   ├── App.tsx               # Full-viewport Game Shell state machine
│   ├── index.css             # Tailwind v4 configuration & typography
│   └── main.tsx              # Application entry point
├── CONTRIBUTING.md           # Guide for adding custom bikes, maps, and tuning physics
├── LICENSE                   # Apache-2.0 License
└── package.json
```

---

## Getting Started

### Prerequisites
- **Node.js** `>= 18.x`
- **npm** `>= 9.x`

### Installation & Local Development

```bash
# Install dependencies
npm install

# Start the development server on http://localhost:3000
npm run dev
```

### Type-Checking & Production Build

```bash
# Run TypeScript type verification
npm run lint

# Build production bundle into /dist
npm run build

# Preview production build locally
npm run preview
```

---

## License

Licensed under the [Apache-2.0 License](./LICENSE).
