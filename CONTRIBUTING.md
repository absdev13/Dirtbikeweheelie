# Contributing to Twelve O'Clock

Thank you for your interest in contributing to **Twelve O'Clock: Dirtbike Wheelie**! This document explains how to set up your development environment, add new dirtbikes or maps, and submit pull requests.

---

## Development Workflow

1. **Fork & Clone** the repository.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the dev server** (`http://localhost:3000`):
   ```bash
   npm run dev
   ```
4. **Verify types & production build** before opening a PR:
   ```bash
   npm run lint
   npm run build
   ```

---

## Adding a New Dirtbike

All dirtbike physics and livery definitions live in `src/game/types.ts` inside the `BIKES` array (`BikeConfig`):

```ts
{
  id: 'custom_bike_id',
  name: 'Custom 300 Enduro',
  displacement: '300cc',
  strokeType: '2-STROKE', // '2-STROKE' or '4-STROKE' (drives Web Audio exhaust synth)
  tagline: 'Balanced low-end lugging torque with crisp top-end over-rev.',
  primaryColor: '#FF5500',
  secondaryColor: '#181A20',
  frameColor: '#FF6B1A',
  rimColor: '#D4AF37',
  torqueMultiplier: 1.12,      // Scales throttle lift & clutch-dump impulse
  brakeAuthority: 1.10,        // Scales rear-brake anti-loop-out counter-torque
  rotationalInertia: 1.0,      // Higher = slower pitch changes; Lower = flickable
  balanceSweetSpotMin: 56,     // Lower bound of sweet-spot arc (degrees)
  balanceSweetSpotMax: 81,     // Upper bound of sweet-spot arc (degrees)
  scrapeAngleMin: 82,          // Angle where titanium rear fender scrapes sparks
  loopOutAngle: 93,            // Angle where bike loops out and crashes
  maxSpeedKmh: 132,            // 6th gear top speed ceiling
  suspensionStiffness: 1.05,   // Spring-damper stiffness on whoops and landings
}
```

---

## Adding a New Terrain Map

Courses are defined in `src/game/types.ts` inside the `COURSES` array (`CourseConfig`):

- `skyTop`, `skyBottom`, `horizonGlow`: CSS hex colors for the vertical sky gradient and sun/floodlight glow.
- `mountainFar`, `mountainNear`: Parallax ridge colors.
- `groundSurface`, `groundSubsoil`: Top crust and subsoil polygon fill colors.
- `hazardFrequency`: Multiplier (`0.7` to `1.5`) controlling the spacing of `WHOOPS`, `KICKER_RAMP`, `MUD_PIT`, `WIND_GUST`, and `TABLETOP` segments.

---

## Architecture & Performance Rules

- **60fps Canvas Isolation**: Keep all high-frequency simulation state inside `WheelieSimulation` (`src/game/simulation.ts`) and `WheelieRenderer` (`src/game/renderer.ts`). Never trigger React state updates on every animation frame; HUD telemetry snapshots are throttled to ~20Hz (`50ms`).
- **Procedural Audio Only**: All new sound effects should be synthesized via Web Audio API oscillators/filters in `src/game/audio.ts` so the game remains self-contained with zero external asset loading failures.
- **Tabular Telemetry**: Any numeric readouts added to `GameHUD.tsx` or `GameModals.tsx` must use `font-mono tabular-nums` to prevent layout jitter.
