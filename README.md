# NexusFactory-Studio

A thin, registry-driven visual host for `NexusFactory-Kits`.

## Boundary

Studio owns **loading, inspection, viewing, snapshots, and download UX** — not factory-generation semantics:

- load a NexusFactory registry
- discover domains and kits
- resolve kit modules and service providers
- render editor surfaces from kit capabilities
- invoke generic kit services
- inspect declared generation phases in Developer mode
- select artifact viewers from kit capabilities
- render artifact previews
- capture viewport snapshots
- download Kit-provided export results

Generation math, parameter/randomization policy, seed behavior, growth, curves, mesh construction, normals, validation, variation, artifact contracts, and export encoding remain inside `NexusFactory-Kits`.

## Flow

```text
Studio boots
  → loads registry.json
  → discovers kits
  → imports selected kit module
  → describe()
  → derives editor surfaces
  → invokes kit service
  → receives state/artifact/export result
  → selects generic viewer
  → displays or downloads result
```

No Studio code knows what a tree, ballista, coral, or future generator subject is.

The generic runtime can invoke:

- `describe`
- `createState`
- `inspectState`
- `runPhase`
- `generate`
- `randomize`
- `reroll`
- `validate`
- `export`

Kits only expose the services they support. Developer phase controls are generated from manifest metadata rather than hard-coded generator knowledge.

## Artifact previews

Current generic preview types:

- `mesh-3d` — Three.js viewer for mesh artifacts
- `image-2d` — canvas viewer for RGBA image artifacts

The 3D viewer consumes Kit-provided `positions`, `normals`, `indices`, and materials. Studio does not compute asset normals or geometry.

```text
Kit artifact
    |
    +-- preview: mesh-3d
    |       → Mesh3DViewer
    |
    +-- preview: image-2d
            → Image2DViewer
```

## Snapshot vs export

These are intentionally separate responsibilities:

```text
Snapshot
  viewport → PNG
  owned by Studio/viewer

Export
  artifact → GLB/PNG/JSON/etc.
  encoded by Kit
  downloaded by Studio
```

Kit export services return `nexusfactory.export-result/1`, including the format, MIME type, file name, and bytes/text.

## Default registry

The browser is pinned to the validated Kits revision containing the phased Tree runtime and standardized Ballista/Coral adapters:

```text
https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@7ed8cddb90782c45361f969745b87c7ed62dbdca/registry.json
```

The pin keeps the registry snapshot and relative kit modules on one immutable revision. Developer mode can load another compatible registry URL when required.

## Run

```bash
npm run validate
npm run serve
```

Open `http://localhost:4173`.

The 3D preview uses Three.js `0.165.0`; the image preview preserves nearest-neighbor rendering for pixel-art artifacts.
