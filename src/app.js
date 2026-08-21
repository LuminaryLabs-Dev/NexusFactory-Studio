import { RegistryHost } from "./registry-host.js";
import { RuntimeHost } from "./runtime-host.js";
import { deriveEditorModel } from "./editor-contract.js";
import { buildCatalog, listCategories, categoryForKit } from "./catalog-model.js";
import { choiceOptions, isChoiceParameter } from "./control-value.js";
import { ViewerHost } from "./viewer-host.js";
import { Mesh3DViewer } from "./viewers/mesh-3d.js";
import { Image2DViewer } from "./viewers/image-2d.js";

const DEFAULT_REGISTRY = "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@338129e1ab86aad7b7da054a3888fe2c3ead493a/registry.json";
const STORAGE = { recent: "nexusfactory.recent", favorites: "nexusfactory.favorites" };
const registry = new RegistryHost();
const runtime = new RuntimeHost(registry);
const $ = (id) => document.getElementById(id);
const elementIds = ["search","developer-toggle","library-nav","catalog","viewport","artifact-bar","kit-title","favorite","controls","advanced","advanced-controls","actions","randomize","randomize-group","reroll-seed","snapshot","export","developer-panel","registry-url","load-registry","phase-inspector","phase-actions","phase-state","kit-meta","diagnostics"];
const elements = Object.fromEntries(elementIds.map((id) => [id, $(id)]));
const viewerHost = new ViewerHost(elements.viewport, {
  "mesh-3d": (container) => new Mesh3DViewer(container),
  "image-2d": (container) => new Image2DViewer(container)
});

let currentManifest = null;
let currentModel = null;
let currentArtifact = null;
let currentPhaseState = null;
let controls = new Map();
let controlLabels = new Map();
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
function supports(service) { return currentManifest?.services?.includes(service) === true; }
function phaseOrder() { return Array.isArray(currentManifest?.metadata?.phaseOrder) ? currentManifest.metadata.phaseOrder : []; }

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
  fragment.append(navButton("All", "All", kits.length)); fragment.append(navButton("Recent", "Recent", uniqueExisting(recent).length)); fragment.append(navButton("Favorites", "Favorites", uniqueExisting(favorites).length));
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
  for (const entry of entries) { const item = document.createElement("button"); item.className = `generator-card${currentManifest?.id === entry.id ? " active" : ""}`; const title = document.createElement("strong"); title.textContent = entry.title; const meta = document.createElement("span"); meta.textContent = entry.category; item.append(title, meta); item.addEventListener("click", () => selectKit(entry.id)); fragment.append(item); }
  elements.catalog.replaceChildren(fragment);
}

function collectParams() { return Object.fromEntries([...controls.entries()].filter(([id]) => id !== "seed").map(([id, input]) => [id, input.type === "range" ? Number(input.value) : input.value])); }
function currentSeed() { return String(controls.get("seed")?.value ?? `${currentManifest?.id ?? "factory"}:001`); }
function labelForValue(param, input) { return isChoiceParameter(param) ? (input.selectedOptions[0]?.textContent ?? input.value) : input.value; }
function applyParams(params = {}) {
  const schema = new Map(currentModel.parameters.map((entry) => [entry.id, entry]));
  for (const [id, value] of Object.entries(params)) { const input = controls.get(id), param = schema.get(id); if (!input || !param) continue; input.value = String(value); const label = controlLabels.get(id); if (label) label.textContent = labelForValue(param, input); }
}
function makeField(param, container) {
  const field = document.createElement("div"); field.className = "field"; const label = document.createElement("label"); const name = document.createElement("span"); name.textContent = param.label ?? param.id; const value = document.createElement("span"); label.append(name, value);
  let input;
  if (isChoiceParameter(param)) { input = document.createElement("select"); for (const option of choiceOptions(param)) { const node = document.createElement("option"); node.value = option.value; node.textContent = option.label; input.appendChild(node); } input.value = String(param.default ?? input.options[0]?.value ?? ""); const update = () => { value.textContent = labelForValue(param, input); scheduleGenerate(); }; input.addEventListener("change", update); }
  else { input = document.createElement("input"); input.type = "range"; input.min = param.minimum; input.max = param.maximum; input.step = param.step ?? (param.type === "integer" ? 1 : 0.01); input.value = param.default; input.addEventListener("input", () => { value.textContent = input.value; scheduleGenerate(); }); }
  value.textContent = labelForValue(param, input); field.append(label, input); container.appendChild(field); controls.set(param.id, input); controlLabels.set(param.id, value);
}

function renderPhaseInspector() {
  currentPhaseState = null; elements["phase-actions"].replaceChildren(); elements["phase-state"].textContent = "No phase state.";
  const phases = phaseOrder(); const available = supports("createState") && supports("inspectState") && supports("runPhase") && phases.length > 0;
  elements["phase-inspector"].hidden = !available;
  if (!available) return;
  for (const phase of phases) { const button = document.createElement("button"); button.textContent = phase; button.addEventListener("click", () => runDebugThrough(phase).catch(showError)); elements["phase-actions"].appendChild(button); }
}
function renderInspector(manifest) {
  currentModel = deriveEditorModel(manifest); controls = new Map(); controlLabels = new Map(); elements["kit-title"].textContent = currentModel.title; elements.controls.replaceChildren(); elements["advanced-controls"].replaceChildren();
  for (const param of currentModel.primaryParameters) makeField(param, elements.controls); for (const param of currentModel.advancedParameters) makeField(param, elements["advanced-controls"]);
  if (currentModel.showSeed) { const field = document.createElement("div"); field.className = "field"; const label = document.createElement("label"); label.textContent = "Seed"; const input = document.createElement("input"); input.value = `${manifest.id}:001`; input.addEventListener("change", scheduleGenerate); field.append(label, input); elements["advanced-controls"].appendChild(field); controls.set("seed", input); }
  elements.advanced.hidden = elements["advanced-controls"].childElementCount === 0; elements.actions.hidden = false; elements["randomize-group"].replaceChildren();
  for (const group of currentModel.randomizationGroups) { const option = document.createElement("option"); option.value = group.id; option.textContent = group.label; elements["randomize-group"].appendChild(option); }
  const canRandomize = supports("randomize"); elements.randomize.disabled = !canRandomize; elements["randomize-group"].disabled = !canRandomize; elements.randomize.title = canRandomize ? "Randomize parameters using the Kit policy" : "This Kit does not expose randomize().";
  elements["reroll-seed"].disabled = !supports("reroll"); elements.export.hidden = !currentModel.showExport; elements.snapshot.hidden = false;
  elements["kit-meta"].textContent = JSON.stringify({ id: manifest.id, domainPath: manifest.domainPath, version: manifest.version, provides: manifest.provides, services:manifest.services, source: manifest.source, editor: manifest.editor, metadata:manifest.metadata }, null, 2);
  renderPhaseInspector(); updateFavorite();
}

async function selectKit(id) {
  setStatus("Loading generator…");
  try { const described = await runtime.describe(id); currentManifest = described; currentArtifact = null; currentPhaseState = null; touchRecent(id); renderNavigation(); renderCatalog(); renderInspector(described); diagnostics({ selected: id }); await generate(); }
  catch (error) { showError(error); }
}
function unsupportedPreview(preview) { const empty = document.createElement("div"); empty.className = "empty-state"; const title = document.createElement("strong"); title.textContent = "Preview unavailable"; const detail = document.createElement("span"); detail.textContent = `Preview type "${preview ?? "none"}" is not supported by this Studio build.`; empty.append(title, detail); elements.viewport.replaceChildren(empty); }
async function showArtifact(artifact) { currentArtifact = artifact; const result = viewerHost.show(currentModel.preview, artifact); if (!result.supported) { unsupportedPreview(result.type); setStatus(`Preview type "${result.type}" is unsupported.`, true); return; } setStatus("Ready."); }

async function generate() {
  if (!currentManifest) return;
  if (generating) { pendingGenerate = true; return; }
  generating = true; setStatus("Generating…");
  try { const artifact = await runtime.generate(currentManifest.id, { seed: currentSeed(), params: collectParams() }); const validation = await runtime.validate(currentManifest.id, artifact); if (!validation.valid) throw new Error(`Generated artifact failed validation (${validation.checks.filter((check) => !check.pass).map((check) => check.id).join(", ")})`); currentPhaseState = null; await showArtifact(artifact); diagnostics({ valid: true, statistics: artifact.statistics, hash: artifact.deterministicHash, validation }); }
  catch (error) { showError(error); }
  finally { generating = false; if (pendingGenerate) { pendingGenerate = false; queueMicrotask(generate); } }
}
function scheduleGenerate() { clearTimeout(generateTimer); generateTimer = setTimeout(generate, 180); }

async function randomizeCurrent() {
  if (!currentManifest || !supports("randomize")) return;
  clearTimeout(generateTimer); const groupId = elements["randomize-group"].value;
  const result = await runtime.randomize(currentManifest.id, { seed: currentSeed(), params: collectParams(), groupId });
  if (!result?.artifact || !result?.params) throw new TypeError("Kit randomize() must return { seed, params, artifact }.");
  applyParams(result.params); if (controls.has("seed")) controls.get("seed").value = result.seed;
  const validation = await runtime.validate(currentManifest.id, result.artifact); if (!validation.valid) throw new Error("Randomized artifact failed validation.");
  await showArtifact(result.artifact); diagnostics({ randomized: groupId, valid: true, seed: result.seed, params: result.params, validation });
}
async function rerollCurrent() {
  if (!currentManifest || !supports("reroll")) return;
  clearTimeout(generateTimer); const result = await runtime.reroll(currentManifest.id, { seed: currentSeed(), params: collectParams() });
  if (!result?.artifact || !result?.seed) throw new TypeError("Kit reroll() must return { seed, artifact }.");
  if (result.params) applyParams(result.params); if (controls.has("seed")) controls.get("seed").value = result.seed;
  const validation = await runtime.validate(currentManifest.id, result.artifact); if (!validation.valid) throw new Error("Rerolled artifact failed validation.");
  await showArtifact(result.artifact); diagnostics({ rerolled: true, valid: true, seed: result.seed, validation });
}

function triggerDownload(blob, fileName) { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
async function snapshotCurrent() {
  if (!currentArtifact) await generate(); if (!currentArtifact) return;
  const blob = await viewerHost.snapshot("image/png"); const suffix = currentArtifact.deterministicHash?.slice(-8) ?? "snapshot"; triggerDownload(blob, `${currentManifest.id}-${suffix}.png`); setStatus("Snapshot saved.");
}
async function exportCurrent() {
  if (!currentArtifact) await generate(); if (!currentArtifact) return;
  const validation = await runtime.validate(currentManifest.id, currentArtifact); if (!validation.valid) throw new Error("Cannot export an invalid artifact.");
  const format = currentModel.exportFormats[0] ?? "glb"; const output = await runtime.exportArtifact(currentManifest.id, currentArtifact, format);
  if (output?.schemaVersion !== "nexusfactory.export-result/1" || !output.mimeType || !output.fileName) throw new TypeError(`Kit ${currentManifest.id} must return nexusfactory.export-result/1 from export().`);
  const blob = output.bytes instanceof Uint8Array ? new Blob([output.bytes], { type: output.mimeType }) : new Blob([String(output.text ?? "")], { type: output.mimeType }); triggerDownload(blob, output.fileName); setStatus(`Exported ${String(output.format).toUpperCase()}.`);
}

async function runDebugThrough(targetPhase) {
  if (!currentManifest || !supports("createState") || !supports("runPhase")) return;
  setStatus(`Running through ${targetPhase}…`); let state = await runtime.createState(currentManifest.id, { seed: currentSeed(), params: collectParams() });
  for (const phase of phaseOrder()) { state = await runtime.runPhase(currentManifest.id, state, phase); if (phase === targetPhase) break; }
  currentPhaseState = state; const inspected = await runtime.inspectState(currentManifest.id, state); const output = state.outputs?.[targetPhase] ?? (targetPhase === "artifact" ? state.artifact : targetPhase === "validate" ? state.validation : null);
  elements["phase-state"].textContent = JSON.stringify({ inspected, output }, null, 2); if (state.artifact) await showArtifact(state.artifact); else setStatus(`${targetPhase} state ready.`); diagnostics({ phase:targetPhase, inspected });
}

async function loadRegistry() {
  viewerHost.dispose(); elements.viewport.replaceChildren(); const url = elements["registry-url"].value.trim(); setStatus("Loading generator library…"); const snapshot = await registry.load(url); currentManifest = null; currentArtifact = null; currentPhaseState = null; recent = uniqueExisting(recent); favorites = uniqueExisting(favorites); renderNavigation(); renderCatalog(); setStatus(`${snapshot.kits.length} generators ready.`); diagnostics({ registry: snapshot.integrity, domains: snapshot.domains.length, kits: snapshot.kits.length }); const first = uniqueExisting(recent)[0] ?? snapshot.kits[0]?.id; if (first) await selectKit(first);
}
function toggleDeveloper() { const active = !document.body.classList.contains("developer"); document.body.classList.toggle("developer", active); elements["developer-toggle"].setAttribute("aria-pressed", String(active)); elements["developer-panel"].hidden = !active; }
function showError(error) { setStatus(error.message, true); diagnostics({ error: error.message, stack: error.stack }); }

elements.search.addEventListener("input", () => { if (elements.search.value.trim()) selectedCategory = "All"; renderNavigation(); renderCatalog(); });
elements["developer-toggle"].addEventListener("click", toggleDeveloper); elements.favorite.addEventListener("click", toggleFavorite);
elements.randomize.addEventListener("click", () => randomizeCurrent().catch(showError)); elements["reroll-seed"].addEventListener("click", () => rerollCurrent().catch(showError)); elements.snapshot.addEventListener("click", () => snapshotCurrent().catch(showError)); elements.export.addEventListener("click", () => exportCurrent().catch(showError)); elements["load-registry"].addEventListener("click", () => loadRegistry().catch(showError));
document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); elements.search.focus(); elements.search.select(); } });
globalThis.addEventListener?.("beforeunload", () => viewerHost.dispose());

loadRegistry().catch((error) => { setStatus(error.message, true); diagnostics({ error: error.message, hint: "Enable Developer mode to inspect or replace the registry URL." }); });
