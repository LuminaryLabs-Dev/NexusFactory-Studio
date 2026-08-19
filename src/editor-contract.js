export function deriveEditorModel(manifest) {
  if (!manifest) throw new TypeError("deriveEditorModel requires a kit manifest.");
  const surfaces = new Set(manifest.editor?.surfaces ?? []);
  return Object.freeze({
    kitId: manifest.id,
    title: manifest.displayName ?? manifest.id,
    preview: manifest.editor?.preview ?? (manifest.provides?.includes("artifact:mesh") ? "mesh-3d" : "none"),
    inspector: manifest.editor?.inspector ?? "schema",
    parameters: Object.freeze((manifest.parameterSchema ?? []).map((entry) => Object.freeze({ ...entry }))),
    surfaces: Object.freeze([...surfaces]),
    showSeed: surfaces.has("seed") || manifest.provides?.includes("seed:deterministic"),
    showAnimation: surfaces.has("animation") || manifest.provides?.includes("artifact:animation"),
    showExport: surfaces.has("export") || manifest.provides?.some((token) => token.startsWith("export:")),
    exportFormats: Object.freeze((manifest.provides ?? []).filter((token) => token.startsWith("export:")).map((token) => token.slice("export:".length)))
  });
}
