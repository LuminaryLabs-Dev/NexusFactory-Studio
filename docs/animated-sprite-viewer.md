# Generic Animated Sprite Viewer

Studio supports the registered `sprite-2d` preview type for any compatible Kit, including Magic VFX. It does not know about elemental profiles or own animation math.

## Contract

The Kit supplies `artifactKind: "image"` with an RGBA atlas and `metadata.animation` describing `nexusfactory.sprite-atlas/1` (frame width/height, frame count, rows, columns, frames per second, row-major order and loop flag).

The viewer decodes the immutable source pixels, draws each native sprite with nearest-neighbor scaling, supports play/pause and frame stepping, stops when a one-shot reaches its final frame and wraps only when `loop` is true. Viewport snapshots and Kit-owned exports are separate actions.

Studio exposes the same schema-derived parameters, randomization groups, seeds and export choices as it does for existing Kits. It must not contain special cases for `factory-vfx-magic-effect`.

## Verification

Run `npm run validate` and exercise a live registry import and browser-generated artifact. A successful build or GitHub Pages deployment alone does not prove visual playback. If browser validation is blocked, record that limitation explicitly.

Related Kit: https://github.com/LuminaryLabs-Dev/NexusFactory-Kits/blob/main/docs/magic-vfx.md
