# NexusFactory-Studio

A thin, registry-driven visual host for `NexusFactory-Kits`.

## Boundary

Studio owns **loading, inspection, viewing, snapshots, and download UX** — not factory-generation semantics. It loads the registry, derives editor surfaces from manifests, invokes generic Kit services, selects generic viewers, inspects declared phases, and downloads Kit-provided exports.

Generation math, parameter/randomization policy, seed behavior, generation phases, geometry/raster construction, validation, artifact contracts, and export encoding remain inside `NexusFactory-Kits`.

No Studio code knows what a tree, ballista, coral, fish, reef, aquarium, or other generator subject is.

## Generic runtime

Studio can invoke `describe`, phased generation services, `generate`, `randomize`, `reroll`, `validate`, and `export`. Controls, sections, debounce policy, randomization groups, preview selection, and export formats come from each Kit manifest.

## Artifact previews

Current generic preview types:

- `mesh-3d` — Three.js viewer for mesh and textured-mesh artifacts
- `image-2d` — canvas viewer for RGBA image artifacts
- `sprite-2d` — generic animated RGBA atlas viewer with play, pause, stepping, one-shot completion and loop support

The 3D viewer supports positions, normals, indices, UVs, tangents, vertex colors, artifact textures, standard PBR maps, alpha modes, clearcoat, iridescence, transmission, render hints, ACES tone mapping, and artifact-owned sidedness. Snapshot and export remain separate: Studio owns viewport snapshots; Kits own artifact export encoding.

## Live registry

`main` is the live channel. Studio loads the current NexusFactory-Kits registry by default:

```text
https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json
```

Registry fetches and dynamic module imports are cache-busted. Developer mode can load another compatible registry URL explicitly.

## Run

```bash
npm run validate
npm run serve
```

Open `http://localhost:4173`.

The 3D preview uses Three.js `0.165.0`. The image preview preserves nearest-neighbor rendering for pixel-art artifacts.

## Validate the live Kit channel

The networked validator downloads each live Kit module and every relative dependency into a separate temporary ESM tree. It imports and exercises one Kit at a time, including deterministic generation, randomization, reroll, validation, declared phases, and export.

```bash
npm run validate:live-registry
npm run validate:live-registry -- --report validation/live-registry/module-report.json
```

The command does not use the local `NexusFactory-Kits` checkout. It requires network access to the configured registry and source-module host. The current module report, browser report, and exactly ten browser renders are documented in [`validation/live-registry/README.md`](validation/live-registry/README.md).

## Animated sprite previews

The [generic sprite viewer](docs/animated-sprite-viewer.md) reads animation metadata from any compatible Kit artifact. Generation logic remains in NexusFactory-Kits.
