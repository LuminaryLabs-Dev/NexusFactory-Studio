# NexusFactory-Studio

A thin, registry-driven visual host for `NexusFactory-Kits`.

## Boundary

Studio owns **loading and hosting**, not factory-generation semantics:

- load a NexusFactory registry
- discover domains and kits
- resolve kit modules and service providers
- choose browser/Node/cloud runtime adapters
- render editor surfaces from kit capabilities
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
  -> renders returned artifact
```

No code in Studio knows what a ballista or tree is. Both are handled through the same `describe / generate / reroll / validate / export` service boundary.

## Default registry

The browser defaults to:

```text
https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json
```

You can replace the URL in the top bar. Relative kit module paths are resolved against the registry URL, so the same Studio can load other compatible registries.

## Run

```bash
npm run validate
npm run serve
```

Open `http://localhost:4173`.

The 3D preview uses pinned Three.js `0.165.0`. The viewer is generic and consumes mesh artifacts returned by registered kits.
