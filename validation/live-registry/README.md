# Live Registry Validation

Evidence captured on 2026-08-25 against:

```text
https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json
```

Registry integrity: `sha256:376af9547304ce640243435008db7a816277a9dd8cfea83151e8b2802e71f658`.

## Results

- Live module validation: **PASS**, 8/8 Kits.
- Browser actions: generation, validation, randomization, reroll, and export reached for 8/8 Kits.
- Browser image previews: **PASS**, 5/5 image Kits.
- Browser mesh previews: **BLOCKED**, 0/3, because the validation browser returned `Error creating WebGL context.`
- Captured browser renders: exactly **10**, all with valid artifact reports and distinct deterministic hashes.

The browser verdict is intentionally `PARTIAL`. The three mesh Kits generated and validated before preview, their controls changed during randomize and reroll, and their GLB exports completed. Their Three.js pixels were not proven in the cloud browser because WebGL was unavailable. This is an environment limitation, not evidence of an application pass or failure.

## Render matrix

| File | Kit | Variation |
| --- | --- | --- |
| `01-coral-staghorn-pink.jpg` | Coral Generator | staghorn, pink |
| `02-coral-brain-purple.jpg` | Coral Generator | brain, purple |
| `03-fish-streamlined-reef-right.jpg` | Fish Generator | streamlined, reef, right, fork |
| `04-fish-round-blue-left.jpg` | Fish Generator | round, blue, left, fan |
| `05-flora-seagrass-green.jpg` | Aquatic Flora Generator | seagrass, green |
| `06-flora-kelp-gold.jpg` | Aquatic Flora Generator | kelp, gold |
| `07-reef-mixed-pink-tropical.jpg` | Reef Generator | mixed, pink, tropical |
| `08-reef-sea-fan-purple-deep.jpg` | Reef Generator | sea fan, purple, deep |
| `09-aquarium-mixed-gold-emerald.jpg` | Aquarium Generator | mixed, gold, emerald |
| `10-aquarium-brain-orange-tropical.jpg` | Aquarium Generator | brain, orange, tropical |

## Evidence files

- [`module-report.json`](module-report.json) records each downloaded module graph and service result.
- [`browser-report.json`](browser-report.json) records browser actions, validation hashes, the WebGL blocker, and render metadata.
- [`renders/`](renders/) contains the ten browser captures listed above.

## Reproduce

```bash
npm run validate
npm run validate:live-registry -- --report validation/live-registry/module-report.json
npm run serve
```

Open Studio, confirm the live registry reports eight generators, and exercise Generate, Randomize, Reroll Seed, Snapshot, and Export. A WebGL-capable browser is required to close the remaining three mesh-preview checks.
