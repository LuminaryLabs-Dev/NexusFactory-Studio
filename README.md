# NexusFactory-Studio

A thin, registry-driven visual host for `NexusFactory-Kits`.

## Boundary

Studio owns **loading and hosting**, not factory-generation semantics:

- load a NexusFactory registry
- discover domains and kits
- resolve kit modules and service providers
- choose browser/Node/cloud runtime adapters
- render editor surfaces from kit capabilities
- select artifact viewers from kit capabilities
- render artifact previews
- maintain workspace/session UI
- invoke kit services

Generation, seed policy, reroll semantics, validation, variation, artifact contracts, and export logic remain inside `NexusFactory-Kits`.

## Flow

```text
Studio boots
  -> loads registry.json
  -> reads domain hierarchy
  -> discovers kits
  -> loads selected kit module
  -> derives editor surfaces from manifest
  -> invokes kit services
  -> selects the manifest preview type
  -> renders the returned artifact
```

No code in Studio knows what a tree, ballista, coral, or other generator subject is. Generator-specific semantics stay in `NexusFactory-Kits`; Studio handles every kit through the same `describe / generate / reroll / validate / export` service boundary.

## Artifact previews

Artifact previews are selected generically from kit capabilities.

Current preview types:

- `mesh-3d` — generic Three.js viewer for mesh artifacts
- `image-2d` — generic pixel/image viewer for RGBA image artifacts

```text
Kit manifest
    |
    +-- preview: mesh-3d
    |       -> Mesh3DViewer
    |
    +-- preview: image-2d
            -> Image2DViewer
```

Studio contains no generator-specific rendering logic.

## Default registry

The browser defaults to the validated NexusFactory-Kits revision that contains the current Tree, Ballista, and Coral generators:

```text
https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@e4d8ee60e5afbac03657330ab10dccfacaef7ee8/registry.json
```

The default is commit-pinned intentionally so the registry and its relative kit modules come from one immutable revision. Developer mode can replace the registry URL with `@main`, another commit, a tag, or any compatible registry.

Registry fetches are cache-busted on reload while the canonical registry URL remains the base for resolving relative kit modules.

## Run

```bash
npm run validate
npm run serve
```

Open `http://localhost:4173`.

The 3D preview uses pinned Three.js `0.165.0`. The image preview preserves nearest-neighbor rendering for pixel-art artifacts.
