# NexusFactory-Studio

A thin, registry-driven visual host for `NexusFactory-Kits`.

## Boundary

Studio owns **loading, inspection, viewing, snapshots, and download UX** — not factory-generation semantics. It loads the registry, derives editor surfaces from manifests, invokes generic Kit services, selects generic viewers, inspects declared phases, and downloads Kit-provided exports.

Generation math, parameter/randomization policy, seed behavior, generation phases, geometry/raster construction, validation, artifact contracts, and export encoding remain inside `NexusFactory-Kits`.

No Studio code knows what a tree, ballista, coral, fish, reef, aquarium, or other generator subject is.

## Generic runtime

Studio can invoke:

- `describe`
- `createState`
- `inspectState`
- `runPhase`
- `generate`
- `randomize`
- `reroll`
- `validate`
- `export`

Kits expose only the services they support. Developer phase controls are generated from manifest metadata rather than hard-coded generator knowledge.

## Artifact previews

Current generic preview types:

- `mesh-3d` — Three.js viewer for mesh artifacts
- `image-2d` — canvas viewer for RGBA image artifacts

Snapshot and export remain separate: Studio owns viewport snapshots; Kits own artifact export encoding.

## Live registry

`main` is the live channel. Studio loads the current NexusFactory-Kits registry by default:

```text
https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json
```

Registry fetches are cache-busted by `RegistryHost`; relative Kit module resolution remains anchored to the canonical registry URL. If a live Kit has a defect, the owning repository fixes and validates `main` forward rather than pinning Studio backward to an older revision.

Developer mode can still load another compatible registry URL explicitly.

## Run

```bash
npm run validate
npm run serve
```

Open `http://localhost:4173`.

The 3D preview uses Three.js `0.165.0`; the image preview preserves nearest-neighbor rendering for pixel-art artifacts.
