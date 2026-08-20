const CATEGORY_RULES = [
  [":weapon", "Weapons"], [":foliage", "Nature"], [":structure", "Structures"], [":vehicle", "Vehicles"],
  [":material", "Materials"], [":texture", "Textures"], [":vfx", "VFX"], [":scene", "Scenes"], [":animation", "Animation"], [":prop", "Props"]
];

export function categoryForKit(kit) {
  if (kit?.editor?.category) return String(kit.editor.category);
  const path = String(kit?.domainPath ?? "");
  return CATEGORY_RULES.find(([needle]) => path.includes(needle))?.[1] ?? "Other";
}

export function tagsForKit(kit) {
  const explicit = kit?.editor?.tags ?? [];
  const derived = String(kit?.domainPath ?? "").split(":").slice(2);
  return [...new Set([...explicit, ...derived].map((v) => String(v).toLowerCase()))];
}

export function catalogEntry(kit) {
  return Object.freeze({
    id: kit.id,
    title: kit.editor?.title ?? kit.displayName ?? kit.id,
    category: categoryForKit(kit),
    tags: Object.freeze(tagsForKit(kit)),
    searchable: `${kit.editor?.title ?? kit.displayName ?? kit.id} ${categoryForKit(kit)} ${tagsForKit(kit).join(" ")}`.toLowerCase()
  });
}

export function buildCatalog(kits = [], query = "", category = "All") {
  const needle = String(query).trim().toLowerCase();
  return kits.map(catalogEntry).filter((entry) => (category === "All" || entry.category === category) && (!needle || entry.searchable.includes(needle))).sort((a, b) => a.title.localeCompare(b.title));
}

export function listCategories(kits = []) {
  return [...new Set(kits.map(categoryForKit))].sort();
}
