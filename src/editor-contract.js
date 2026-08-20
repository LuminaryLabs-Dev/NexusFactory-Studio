function byId(schema = []) { return new Map(schema.map((entry) => [String(entry.id), Object.freeze({ ...entry })])); }
function select(ids = [], map) { return ids.filter((id) => id !== "seed").map((id) => map.get(String(id))).filter(Boolean); }

export function deriveEditorModel(manifest) {
  if (!manifest) throw new TypeError("deriveEditorModel requires a kit manifest.");
  const surfaces = new Set(manifest.editor?.surfaces ?? []);
  const parameters = Object.freeze((manifest.parameterSchema ?? []).map((entry) => Object.freeze({ ...entry })));
  const map = byId(parameters);
  const hasLevels = (manifest.editor?.primary?.length ?? 0) + (manifest.editor?.advanced?.length ?? 0) + (manifest.editor?.internal?.length ?? 0) > 0;
  const inferredAdvanced = parameters.filter((entry) => /(count|segments?|resolution|iterations?|octaves?|samples?|subdivisions?)/i.test(String(entry.id))).map((entry) => entry.id);
  const inferredAdvancedSet = new Set(inferredAdvanced);
  const primaryIds = hasLevels ? (manifest.editor?.primary ?? []) : parameters.filter((entry) => !inferredAdvancedSet.has(entry.id)).map((entry) => entry.id);
  const advancedIds = hasLevels ? (manifest.editor?.advanced ?? []) : inferredAdvanced;
  const internalIds = new Set(manifest.editor?.internal ?? []);
  const primary = select(primaryIds, map).filter((entry) => !internalIds.has(entry.id));
  const primarySet = new Set(primary.map((entry) => entry.id));
  const advanced = select(advancedIds, map).filter((entry) => !internalIds.has(entry.id) && !primarySet.has(entry.id));
  const assigned = new Set([...primarySet, ...advanced.map((entry) => entry.id), ...internalIds]);
  for (const entry of parameters) if (!assigned.has(entry.id)) primary.push(entry);
  return Object.freeze({
    kitId: manifest.id,
    title: manifest.editor?.title ?? manifest.displayName ?? manifest.id,
    category: manifest.editor?.category ?? null,
    tags: Object.freeze([...(manifest.editor?.tags ?? [])]),
    preview: manifest.editor?.preview ?? (manifest.provides?.includes("artifact:mesh") ? "mesh-3d" : "none"),
    inspector: manifest.editor?.inspector ?? "schema",
    parameters,
    primaryParameters: Object.freeze(primary),
    advancedParameters: Object.freeze(advanced),
    internalParameters: Object.freeze(select([...internalIds], map)),
    surfaces: Object.freeze([...surfaces]),
    showSeed: (manifest.editor?.advanced ?? []).includes("seed") || surfaces.has("seed") || manifest.provides?.includes("seed:deterministic"),
    showAnimation: surfaces.has("animation") || manifest.provides?.includes("artifact:animation"),
    showExport: surfaces.has("export") || manifest.provides?.some((token) => token.startsWith("export:")),
    exportFormats: Object.freeze((manifest.provides ?? []).filter((token) => token.startsWith("export:")).map((token) => token.slice("export:".length))),
    randomizationGroups: Object.freeze((manifest.editor?.randomizationGroups?.length ? manifest.editor.randomizationGroups : [
      { id: "everything", label: "Everything", parameters: parameters.map((entry) => entry.id), rerollSeed: true },
      { id: "shape", label: "Shape", parameters: primary.filter((entry) => !/(wear|roughness|metallic|color|material|weather)/i.test(entry.id)).map((entry) => entry.id), rerollSeed: false },
      { id: "details", label: "Details", parameters: advanced.map((entry) => entry.id), rerollSeed: false },
      { id: "materials", label: "Materials", parameters: parameters.filter((entry) => /(wear|roughness|metallic|color|material|weather)/i.test(entry.id)).map((entry) => entry.id), rerollSeed: false }
    ].filter((entry) => entry.parameters.length || entry.rerollSeed)).map((entry) => Object.freeze({ ...entry, parameters: Object.freeze([...(entry.parameters ?? [])]) })))
  });
}
