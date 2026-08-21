import { RegistryHost } from "./registry-host.js";
import { RuntimeHost } from "./runtime-host.js";
import { deriveEditorModel } from "./editor-contract.js";
import { buildCatalog, listCategories, categoryForKit } from "./catalog-model.js";
import { choiceOptions, isChoiceParameter, randomControlValue } from "./control-value.js";
import { ViewerHost } from "./viewer-host.js";
import { mimeTypeForFormat } from "./viewer-contract.js";
import { Mesh3DViewer } from "./viewers/mesh-3d.js";
import { Image2DViewer } from "./viewers/image-2d.js";

const DEFAULT_REGISTRY = "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json";
const STORAGE = { recent: "nexusfactory.recent", favorites: "nexusfactory.favorites" };
const registry = new RegistryHost();
const runtime = new RuntimeHost(registry);
const $ = (id) => document.getElementById(id);
const elements = Object.fromEntries(["search","developer-toggle","library-nav","catalog","viewport","artifact-bar","kit-title","favorite","controls","advanced","advanced-controls","actions","randomize","randomize-group","export","developer-panel","registry-url","load-registry","kit-meta","diagnostics"].map((id) => [id, $(id)]));
const viewerHost = new ViewerHost(elements.viewport, {
  "mesh-3d": (container) => new Mesh3DViewer(container),
  "image-2d": (container) => new Image2DViewer(container)
});

let currentManifest = null;
let currentModel = null;
let currentArtifact = null;
let controls = new Map();
let selectedCategory = "Recent";
let generateTimer = null;
let generating = false;
let pendingGenerate = false;
let recent = readList(STORAGE.recent);
let favorites = readList(STORAGE.favorites);

elements["registry-url"].value = new URLSearchParams(location.search).get("registry") ?? DEFAULT_REGISTRY;

function readList(key) { try { return JSON.parse(localStorage.getItem(key) ?? "[]").filter(Boolean); } catch { return []; } }
function saveList(key, values) { localStorage.setItem(key, JSON.stringify(values)); }
function setStatus(text, error = false) { elements["artifact-bar"].textContent = text; elements["artifact-bar"].classList.toggle("error", error); }
function diagnostics(value) { elements.diagnostics.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
function uniqueExisting(ids) { const existing = new Set(registry.listKits().map((kit) => kit.id)); return ids.filter((id, index) => existing.has(id) && ids.indexOf(id) === index); }

function touchRecent(id) { recent = [id, ...recent.filter((entry) => entry !== id)].slice(0, 12); saveList(STORAGE.recent, recent); }
function toggleFavorite() { if (!currentManifest) return; const id = currentManifest.id; favorites = favorites.includes(id) ? favorites.filter((entry) => entry !== id) : [id, ...favorites]; saveList(STORAGE.favorites, favorites); updateFavorite(); renderNavigation(); renderCatalog(); }
function updateFavorite() { if (!currentManifest) { elements.favorite.hidden = true; return; } const active = favorites.includes(currentManifest.id); elements.favorite.hidden = false; elements.favorite.textContent = active ? "★" : "☆"; elements.favorite.title = active ? "Remove favorite" : "Add favorite"; }

function navButton(label, category, count) {
  const node = document.createElement("button"); node.className = `nav-button${selectedCategory === category ? " active" : ""}`; node.dataset.category = category;
  const text = document.createElement("span"); text.textContent = label; const badge = document.createElement("span"); badge.className = "count"; badge.textContent = count;
  node.append(text, badge); node.addEventListener("click", () => { selectedCategory = category; elements.search.value = ""; renderNavigation(); renderCatalog(); }); return node;
}

function renderNavigation() {
  const kits = registry.listKits(); const fragment = document.createDocumentFragment();
  fragment.append(navButton("All", "All", kits.length));
  fragment.append(navButton("Recent", "Recent", uniqueExisting(recent).length));
  fragment.append(navButton("Favorites", "Favorites", uniqueExisting(favorites).length));
  for (const category of listCategories(kits)) fragment.append(navButton(category, category, kits.filter((kit) => categoryForKit(kit) === category).length));
  elements["library-nav"].replaceChildren(fragment);
}

function visibleKits() {
  const kits = registry.listKits(); const query = elements.search.value;
  if (query.trim()) return buildCatalog(kits, query, "All");
  if (selectedCategory === "Recent") { const order = uniqueExisting(recent); return order.map((id) => buildCatalog(kits).find((entry) => entry.id === id)).filter(Boolean); }
  if (selectedCategory === "Favorites") { const order = uniqueExisting(favorites); return order.map((id) => buildCatalog(kits).find((entry) => entry.id === id)).filter(Boolean); }
  return buildCatalog(kits, "", selectedCategory);
}

function renderCatalog() {
  const entries = visibleKits(); const fragment = document.createDocumentFragment();
  if (!entries.length) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.style.position = "static"; empty.style.padding = "22px 4px"; empty.textContent = elements.search.value ? "No generators found." : "Nothing here yet."; fragment.append(empty); }
  for (const entry of entries) {
    const item = document.createElement("button"); item.className = `generator-card${currentManifest?.id === entry.id ? " active" : ""}`;
    const title = document.createElement("strong"); title.textContent = entry.title; const meta = document.createElement("span"); meta.textContent = entry.category;
    item.append(title, meta); item.addEventListener("click", () => selectKit(entry.id)); fragment.append(item);
  }
  elements.catalog.replaceChildren(fragment);
}

function collectParams() { return Object.fromEntries([...controls.entries()].filter(([id]) => id !== "seed").map(([id, input]) => [id, input.type === "range" ? Number(input.value) : input.value])); }
function currentSeed() { return String(controls.get("seed")?.value ?? `${currentManifest?.id ?? "factory"}:001`); }
function randomUnit() { if (globalThis.crypto?.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 0xffffffff; } return Math.random(); }
function randomValue(param) { return randomControlValue(param, randomUnit); }

function makeField(param, container) {
  const field = document.createElement("div"); field.className = "field";
  const label = document.createElement("label"); const name = document.createElement("span"); name.textContent = param.label ?? param.id; const value = document.createElement("span"); label.append(name, value);
  let input;
  if (isChoiceParameter(param)) {
    input = document.createElement("select");
    for (const option of choiceOptions(param)) { const node = document.createElement("option"); node.value = option.value; node.textContent = option.label; input.appendChild(node); }
    input.value = String(param.default ?? input.options[0]?.value ?? "");
    const update = () => { value.textContent = input.selectedOptions[0]?.textContent ?? input.value; scheduleGenerate(); };
    input.addEventListener("change", update); value.textContent = input.selectedOptions[0]?.textContent ?? input.value;
  } else {
    input = document.createElement("input"); input.type = "range"; input.min = param.minimum; input.max = param.maximum; input.step = param.step ?? (param.type === "integer" ? 1 : 0.01); input.value = param.default;
    input.addEventListener("input", () => { value.textContent = input.value; scheduleGenerate(); }); value.textContent = String(param.default);
  }
  field.append(label, input); container.appendChild(field); controls.set(param.id, input);
}

function renderInspector(manifest) {
  currentModel = deriveEditorModel(manifest); controls = new Map(); elements["kit-title"].textContent = currentModel.title; elements.controls.replaceChildren(); elements["advanced-controls"].replaceChildren();
  for (const param of currentModel.primaryParameters) makeField(param, elements.controls);
  for (const param of currentModel.advancedParameters) makeField(param, elements["advanced-controls"]);
  if (currentModel.showSeed) {
    const field = document.createElement("div"); field.className = "field"; const label = document.createElement("label"); label.textContent = "Seed"; const input = document.createElement("input"); input.value = `${manifest.id}:001`; input.addEventListener("change", scheduleGenerate); field.append(label, input); elements["advanced-controls"].appendChild(field); controls.set("seed", input);
  }
  elements.advanced.hidden = elements["advanced-controls"].childElementCount === 0;
  elements.actions.hidden = false; elements["randomize-group"].replaceChildren();
  for (const group of currentModel.randomizationGroups) { const option = document.createElement("option"); option.value = group.id; option.textContent = group.label; elements["randomize-group"].appendChild(option); }
  elements.export.hidden = !currentModel.showExport;
  elements["kit-meta"].textContent = JSON.stringify({ id: manifest.id, domainPath: manifest.domainPath, version: manifest.version, provides: manifest.provides, source: manifest.source, editor: manifest.editor }, null, 2);
  updateFavorite();
}

async function selectKit(id) {
  setStatus("Loading generator…");
  try {
    const described = await runtime.describe(id); currentManifest = described; currentArtifact = null; touchRecent(id); renderNavigation(); renderCatalog(); renderInspector(described); diagnostics({ selected: id }); await generate();
  } catch (error) { setStatus(error.message, true); diagnostics({ error: error.message, stack: error.stack }); }
}

function unsupportedPreview(preview) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const title = document.createElement("strong"); title.textContent = "Preview unavailable";
  const detail = document.createElement("span"); detail.textContent = `Preview type "${preview ?? "none"}" is not supported by this Studio build.`;
  empty.append(title, detail); elements.viewport.replaceChildren(empty);
}

async function showArtifact(artifact) {
  currentArtifact = artifact;
  const result = viewerHost.show(currentModel.preview, artifact);
  if (!result.supported) {
    unsupportedPreview(result.type);
    setStatus(`Preview type "${result.type}" is unsupported.`, true);
    return;
  }
  setStatus("Ready.");
}

async function generate() {
  if (!currentManifest) return;
  if (generating) { pendingGenerate = true; return; }
  generating = true; setStatus("Generating…");
  try {
    const artifact = await runtime.generate(currentManifest.id, { seed: currentSeed(), params: collectParams() });
    const validation = await runtime.validate(currentManifest.id, artifact);
    if (!validation.valid) throw new Error(`Generated artifact failed validation (${validation.checks.filter((check) => !check.pass).map((check) => check.id).join(", ")})`);
    await showArtifact(artifact); diagnostics({ valid: true, statistics: artifact.statistics, hash: artifact.deterministicHash, validation });
  } catch (error) { setStatus(error.message, true); diagnostics({ error: error.message, stack: error.stack }); }
  finally { generating = false; if (pendingGenerate) { pendingGenerate = false; queueMicrotask(generate); } }
}
function scheduleGenerate() { clearTimeout(generateTimer); generateTimer = setTimeout(generate, 180); }

async function randomizeCurrent() {
  if (!currentManifest || !currentModel) return;
  const group = currentModel.randomizationGroups.find((entry) => entry.id === elements["randomize-group"].value) ?? currentModel.randomizationGroups[0];
  const schema = new Map(currentModel.parameters.map((param) => [param.id, param]));
  for (const id of group.parameters ?? []) { const input = controls.get(id); const param = schema.get(id); if (!input || !param) continue; const next = randomValue(param); input.value = String(next); input.dispatchEvent(new Event(isChoiceParameter(param) ? "change" : "input")); }
  clearTimeout(generateTimer);
  if (group.rerollSeed && controls.has("seed")) {
    const result = await runtime.reroll(currentManifest.id, { seed: currentSeed(), params: collectParams() }); controls.get("seed").value = result.seed; await showArtifact(result.artifact); const validation = await runtime.validate(currentManifest.id, result.artifact); if (!validation.valid) throw new Error("Randomized artifact failed validation."); diagnostics({ randomized: group.id, valid: true, seed: result.seed });
  } else await generate();
}

async function exportCurrent() {
  if (!currentArtifact) await generate(); if (!currentArtifact) return;
  const validation = await runtime.validate(currentManifest.id, currentArtifact); if (!validation.valid) throw new Error("Cannot export an invalid artifact.");
  const format = currentModel.exportFormats[0] ?? "glb"; const output = await runtime.exportArtifact(currentManifest.id, currentArtifact, format);
  const blob = output instanceof Uint8Array ? new Blob([output], { type: mimeTypeForFormat(format) }) : new Blob([String(output)], { type: mimeTypeForFormat(format === "json" ? "json" : format) });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${currentManifest.id}.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); setStatus(`Exported ${format.toUpperCase()}.`);
}

async function loadRegistry() {
  viewerHost.dispose(); elements.viewport.replaceChildren();
  const url = elements["registry-url"].value.trim(); setStatus("Loading generator library…"); const snapshot = await registry.load(url); currentManifest = null; currentArtifact = null; recent = uniqueExisting(recent); favorites = uniqueExisting(favorites); renderNavigation(); renderCatalog(); setStatus(`${snapshot.kits.length} generators ready.`); diagnostics({ registry: snapshot.integrity, domains: snapshot.domains.length, kits: snapshot.kits.length });
  const first = uniqueExisting(recent)[0] ?? snapshot.kits[0]?.id; if (first) await selectKit(first);
}

function toggleDeveloper() { const active = !document.body.classList.contains("developer"); document.body.classList.toggle("developer", active); elements["developer-toggle"].setAttribute("aria-pressed", String(active)); elements["developer-panel"].hidden = !active; }

elements.search.addEventListener("input", () => { if (elements.search.value.trim()) selectedCategory = "All"; renderNavigation(); renderCatalog(); });
elements["developer-toggle"].addEventListener("click", toggleDeveloper); elements.favorite.addEventListener("click", toggleFavorite);
elements.randomize.addEventListener("click", () => randomizeCurrent().catch((error) => { setStatus(error.message, true); diagnostics({ error: error.message }); }));
elements.export.addEventListener("click", () => exportCurrent().catch((error) => { setStatus(error.message, true); diagnostics({ error: error.message }); }));
elements["load-registry"].addEventListener("click", () => loadRegistry().catch((error) => { setStatus(error.message, true); diagnostics({ error: error.message }); }));
document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); elements.search.focus(); elements.search.select(); } });
globalThis.addEventListener?.("beforeunload", () => viewerHost.dispose());

loadRegistry().catch((error) => { setStatus(error.message, true); diagnostics({ error: error.message, hint: "Enable Developer mode to inspect or replace the registry URL." }); });
