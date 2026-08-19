import { RegistryHost } from "./registry-host.js";
import { RuntimeHost } from "./runtime-host.js";
import { deriveEditorModel } from "./editor-contract.js";
import { Mesh3DViewer } from "./viewers/mesh-3d.js";

const DEFAULT_REGISTRY = "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json";
const registry = new RegistryHost();
const runtime = new RuntimeHost(registry);
const elements = Object.fromEntries([
  "registry-url", "load-registry", "registry-status", "catalog", "viewport", "kit-meta", "controls", "actions", "diagnostics", "artifact-bar"
].map((id) => [id, document.getElementById(id)]));

elements["registry-url"].value = new URLSearchParams(location.search).get("registry") ?? DEFAULT_REGISTRY;
let viewer = null;
let currentManifest = null;
let currentModel = null;
let currentArtifact = null;
let controls = new Map();

function diagnostics(value) {
  elements.diagnostics.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function button(label, handler, className = "") {
  const node = document.createElement("button");
  node.textContent = label;
  node.className = className;
  node.addEventListener("click", async () => {
    node.disabled = true;
    try { await handler(); } catch (error) { diagnostics({ error: error.message, stack: error.stack }); }
    finally { node.disabled = false; }
  });
  return node;
}

function renderDomainNodes(nodes, depth = 0) {
  const fragment = document.createDocumentFragment();
  for (const node of nodes) {
    const wrap = document.createElement("div");
    wrap.className = "domain";
    wrap.style.paddingLeft = `${depth * 9}px`;
    const label = document.createElement("div");
    label.className = "domain-label";
    label.textContent = node.domain.domainPath;
    wrap.appendChild(label);
    for (const kit of node.kits) {
      const item = document.createElement("button");
      item.className = `kit-button${currentManifest?.id === kit.id ? " active" : ""}`;
      item.textContent = kit.displayName;
      item.addEventListener("click", () => selectKit(kit.id));
      wrap.appendChild(item);
    }
    wrap.appendChild(renderDomainNodes(node.children, depth + 1));
    fragment.appendChild(wrap);
  }
  return fragment;
}

function renderCatalog() {
  elements.catalog.replaceChildren(renderDomainNodes(registry.domainTree()));
}

function collectParams() {
  return Object.fromEntries([...controls.entries()].filter(([id]) => id !== "seed").map(([id, input]) => [id, input.value]));
}

function currentSeed() {
  return String(controls.get("seed")?.value ?? "default-seed");
}

function renderInspector(manifest) {
  currentModel = deriveEditorModel(manifest);
  controls = new Map();
  elements["kit-meta"].textContent = `${manifest.domainPath}\n${manifest.id}\n${manifest.version}`;
  elements.controls.replaceChildren();
  if (currentModel.showSeed) {
    const field = document.createElement("div"); field.className = "field";
    const label = document.createElement("label"); label.textContent = "Seed";
    const input = document.createElement("input"); input.value = `${manifest.id}:001`;
    field.append(label, input); elements.controls.appendChild(field); controls.set("seed", input);
  }
  for (const param of currentModel.parameters) {
    const field = document.createElement("div"); field.className = "field";
    const label = document.createElement("label");
    const value = document.createElement("span"); value.textContent = String(param.default);
    label.append(document.createTextNode(param.label ?? param.id), value);
    const input = document.createElement("input");
    input.type = "range"; input.min = param.minimum; input.max = param.maximum; input.step = param.step ?? (param.type === "integer" ? 1 : 0.01); input.value = param.default;
    input.addEventListener("input", () => { value.textContent = input.value; });
    field.append(label, input); elements.controls.appendChild(field); controls.set(param.id, input);
  }

  elements.actions.replaceChildren();
  elements.actions.appendChild(button("Generate", generate, "primary"));
  elements.actions.appendChild(button("Reroll", reroll));
  elements.actions.appendChild(button("Validate", validateCurrent));
  if (currentModel.showExport) {
    for (const format of currentModel.exportFormats) elements.actions.appendChild(button(`Export ${format.toUpperCase()}`, () => exportCurrent(format)));
  }
}

async function selectKit(id) {
  currentManifest = registry.getKit(id);
  currentArtifact = null;
  renderCatalog();
  renderInspector(currentManifest);
  diagnostics(await runtime.describe(id));
  elements["artifact-bar"].textContent = "Ready to generate.";
}

async function ensureViewer() {
  if (!viewer) {
    elements.viewport.replaceChildren();
    viewer = new Mesh3DViewer(elements.viewport);
  }
  return viewer;
}

async function showArtifact(artifact) {
  currentArtifact = artifact;
  if (currentModel.preview === "mesh-3d") (await ensureViewer()).show(artifact);
  elements["artifact-bar"].textContent = `${artifact.statistics.meshCount} meshes · ${artifact.statistics.triangleCount} triangles · ${artifact.seed} · ${artifact.deterministicHash.slice(0, 20)}…`;
}

async function generate() {
  if (!currentManifest) return;
  const artifact = await runtime.generate(currentManifest.id, { seed: currentSeed(), params: collectParams() });
  await showArtifact(artifact);
  diagnostics({ generated: true, statistics: artifact.statistics, bounds: artifact.bounds, hash: artifact.deterministicHash, animationTracks: artifact.timeline?.length ?? 0 });
}

async function reroll() {
  if (!currentManifest) return;
  const result = await runtime.reroll(currentManifest.id, { seed: currentSeed(), params: collectParams() });
  controls.get("seed").value = result.seed;
  await showArtifact(result.artifact);
  diagnostics({ rerolled: true, seed: result.seed, hash: result.artifact.deterministicHash });
}

async function validateCurrent() {
  if (!currentArtifact) throw new Error("Generate an artifact first.");
  diagnostics(await runtime.validate(currentManifest.id, currentArtifact));
}

async function exportCurrent(format) {
  if (!currentArtifact) throw new Error("Generate an artifact first.");
  const output = await runtime.exportArtifact(currentManifest.id, currentArtifact, format);
  const blob = output instanceof Uint8Array ? new Blob([output], { type: format === "glb" ? "model/gltf-binary" : "application/octet-stream" }) : new Blob([String(output)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${currentManifest.id}-${currentArtifact.seed}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function loadRegistry() {
  const url = elements["registry-url"].value.trim();
  elements["registry-status"].textContent = `Loading ${url}`;
  const snapshot = await registry.load(url);
  elements["registry-status"].textContent = `${snapshot.domains.length} domains · ${snapshot.kits.length} kits · graph valid`;
  currentManifest = null; currentArtifact = null;
  renderCatalog();
  diagnostics({ registry: snapshot.integrity, domains: snapshot.domains.length, kits: snapshot.kits.length });
}

elements["load-registry"].addEventListener("click", () => loadRegistry().catch((error) => diagnostics({ error: error.message })));
loadRegistry().catch((error) => diagnostics({ error: error.message, hint: "You can replace the registry URL and load again." }));
