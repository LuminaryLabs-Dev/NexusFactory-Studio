import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REGISTRY = "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusFactory-Kits@main/registry.json";
const REGISTRY_SCHEMA = "nexusfactory.registry/1";
const EXPORT_SCHEMA = "nexusfactory.export-result/1";
const args = parseArgs(process.argv.slice(2));
const registryUrl = new URL(args.registry ?? DEFAULT_REGISTRY);
const sourceRootUrl = new URL("./", registryUrl);
const cacheToken = `${Date.now()}-${process.pid}`;

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--registry" || value === "--report") {
      const next = values[index + 1];
      if (!next) throw new TypeError(`${value} requires a value.`);
      parsed[value.slice(2)] = next;
      index += 1;
    } else if (value === "--help") {
      console.log("Usage: node scripts/validate-live-registry.mjs [--registry URL] [--report PATH]");
      process.exit(0);
    } else {
      throw new TypeError(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cacheBusted(url) {
  const request = new URL(url);
  request.searchParams.set("load", cacheToken);
  return request;
}

async function fetchText(url, label) {
  const response = await fetch(cacheBusted(url), { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} request failed (${response.status}) for ${url}`);
  return response.text();
}

function moduleSpecifiers(source) {
  const found = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) found.add(match[1]);
  }
  return [...found];
}

function relativeSourcePath(url) {
  const candidate = new URL(url);
  assert(candidate.origin === sourceRootUrl.origin, `Module escaped source origin: ${url}`);
  assert(candidate.pathname.startsWith(sourceRootUrl.pathname), `Module escaped source root: ${url}`);
  const relative = decodeURIComponent(candidate.pathname.slice(sourceRootUrl.pathname.length));
  const safe = normalize(relative).replace(/^([/\\])+/, "");
  assert(relative && safe !== ".." && !safe.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`), `Unsafe module path: ${relative}`);
  return safe;
}

async function downloadModuleGraph(entryUrl, localRoot, kitLabel) {
  const downloaded = new Map();

  async function visit(url) {
    const canonical = new URL(url);
    canonical.search = "";
    canonical.hash = "";
    const href = canonical.href;
    if (downloaded.has(href)) return;

    const relative = relativeSourcePath(canonical);
    const source = await fetchText(canonical, `Module ${relative}`);
    const target = join(localRoot, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, source, "utf8");
    downloaded.set(href, relative);
    console.log(`    pulled ${relative}`);

    for (const specifier of moduleSpecifiers(source)) {
      assert(specifier.startsWith("."), `${kitLabel} uses unsupported non-relative module specifier ${specifier} in ${relative}`);
      await visit(new URL(specifier, canonical));
    }
  }

  await visit(entryUrl);
  return [...downloaded.values()];
}

function defaultParams(manifest) {
  return Object.fromEntries((manifest.parameterSchema ?? []).map((parameter) => [
    parameter.id,
    parameter.default ?? (typeof parameter.options?.[0] === "object" ? parameter.options[0].value : parameter.options?.[0]),
  ]));
}

function exportFormat(manifest) {
  const formats = (manifest.provides ?? []).filter((value) => value.startsWith("export:")).map((value) => value.slice(7));
  assert(formats.length > 0, `${manifest.id} does not declare an export format.`);
  return formats[0];
}

function outputSize(output) {
  if (output.bytes instanceof Uint8Array) return output.bytes.byteLength;
  if (typeof output.text === "string") return Buffer.byteLength(output.text);
  return 0;
}

function artifactSummary(artifact) {
  if (artifact.artifactKind === "image") {
    return {
      kind: "image-2d",
      width: artifact.image?.width,
      height: artifact.image?.height,
      pixelCount: artifact.statistics?.pixelCount,
    };
  }
  return {
    kind: artifact.textures ? "textured-mesh-3d" : "mesh-3d",
    meshCount: artifact.statistics?.meshCount,
    vertexCount: artifact.statistics?.vertexCount,
    triangleCount: artifact.statistics?.triangleCount,
    textureCount: artifact.statistics?.textureCount ?? 0,
  };
}

async function invoke(services, name, ...values) {
  assert(typeof services?.[name] === "function", `Missing declared service: ${name}`);
  return services[name](...values);
}

async function validateKit(manifest, kit, modules) {
  assert(kit?.services, `${manifest.id} module does not expose services.`);
  for (const service of manifest.services ?? []) assert(typeof kit.services[service] === "function", `${manifest.id} is missing declared service ${service}.`);

  const described = await invoke(kit.services, "describe");
  assert(described?.id === manifest.id, `${manifest.id} describe() returned ${described?.id ?? "no id"}.`);
  assert(!kit.manifest?.id || kit.manifest.id === manifest.id, `${manifest.id} module manifest identity mismatch.`);

  const params = defaultParams(manifest);
  const request = { seed: `${manifest.id}:live-registry-validation`, params };
  const first = await invoke(kit.services, "generate", request);
  const second = await invoke(kit.services, "generate", request);
  assert(first?.kitId === manifest.id, `${manifest.id} generated an artifact owned by ${first?.kitId ?? "no kit"}.`);
  assert(first?.deterministicHash && first.deterministicHash === second?.deterministicHash, `${manifest.id} did not reproduce the same deterministic hash.`);

  const generatedValidation = await invoke(kit.services, "validate", first);
  assert(generatedValidation?.valid === true, `${manifest.id} generate() output failed validation.`);

  const groupId = manifest.editor?.randomizationGroups?.[0]?.id ?? "everything";
  const randomized = await invoke(kit.services, "randomize", { ...request, groupId, entropy: "live-registry-fixed-randomize" });
  assert(randomized?.artifact && randomized?.params, `${manifest.id} randomize() did not return params and artifact.`);
  const randomizedValidation = await invoke(kit.services, "validate", randomized.artifact);
  assert(randomizedValidation?.valid === true, `${manifest.id} randomize() output failed validation.`);

  const rerolled = await invoke(kit.services, "reroll", { ...request, entropy: "live-registry-fixed-reroll" });
  assert(rerolled?.artifact && rerolled?.seed, `${manifest.id} reroll() did not return seed and artifact.`);
  const rerolledValidation = await invoke(kit.services, "validate", rerolled.artifact);
  assert(rerolledValidation?.valid === true, `${manifest.id} reroll() output failed validation.`);

  let phaseResult = null;
  const phases = manifest.metadata?.phaseOrder ?? [];
  if (phases.length > 0) {
    for (const service of ["createState", "inspectState", "runPhase"]) assert(typeof kit.services[service] === "function", `${manifest.id} declares phases without ${service}().`);
    let state = await invoke(kit.services, "createState", request);
    const initial = await invoke(kit.services, "inspectState", state);
    for (const phase of phases) state = await invoke(kit.services, "runPhase", state, phase);
    const completed = await invoke(kit.services, "inspectState", state);
    assert(state.artifact?.deterministicHash === first.deterministicHash, `${manifest.id} phased artifact differs from generate().`);
    assert(state.validation?.valid === true, `${manifest.id} phased validation did not pass.`);
    phaseResult = { order: phases, initialCompleted: initial.completedPhases, completed: completed.completedPhases };
  }

  const format = exportFormat(manifest);
  const output = await invoke(kit.services, "export", first, format);
  assert(output?.schemaVersion === EXPORT_SCHEMA, `${manifest.id} export() returned ${output?.schemaVersion ?? "no schema"}.`);
  assert(output.format === format && output.fileName && output.mimeType, `${manifest.id} export metadata is incomplete.`);
  assert(outputSize(output) > 0, `${manifest.id} export is empty.`);

  return {
    id: manifest.id,
    displayName: manifest.displayName,
    version: manifest.version,
    preview: manifest.editor?.preview,
    sourceModule: manifest.source?.module,
    contentFingerprint: manifest.contentFingerprint,
    modulesPulled: modules.length,
    moduleFiles: modules,
    services: manifest.services,
    deterministicHash: first.deterministicHash,
    deterministicRepeat: true,
    artifact: artifactSummary(first),
    validationChecks: generatedValidation.checks?.length ?? null,
    randomize: { groupId, seed: randomized.seed, hash: randomized.artifact.deterministicHash, valid: true },
    reroll: { seed: rerolled.seed, hash: rerolled.artifact.deterministicHash, valid: true },
    phases: phaseResult,
    export: { format, mimeType: output.mimeType, fileName: output.fileName, bytes: outputSize(output) },
  };
}

const startedAt = new Date().toISOString();
const registryText = await fetchText(registryUrl, "Registry");
const snapshot = JSON.parse(registryText);
assert(snapshot.schemaVersion === REGISTRY_SCHEMA, `Unsupported registry schema: ${snapshot.schemaVersion ?? "missing"}`);
assert(snapshot.capabilityGraph?.valid === true, "Registry capability graph is invalid.");
assert(Array.isArray(snapshot.kits) && snapshot.kits.length > 0, "Registry contains no kits.");
const ids = snapshot.kits.map((kit) => kit.id);
assert(new Set(ids).size === ids.length, "Registry contains duplicate kit ids.");

console.log(`Live registry: ${registryUrl}`);
console.log(`Integrity: ${snapshot.integrity}`);
console.log(`Validating ${snapshot.kits.length} kits sequentially.`);

const scratch = await mkdtemp(join(tmpdir(), "nexusfactory-live-registry-"));
const results = [];
try {
  for (const [index, manifest] of snapshot.kits.entries()) {
    console.log(`[${index + 1}/${snapshot.kits.length}] ${manifest.id}`);
    const localRoot = join(scratch, `${String(index + 1).padStart(2, "0")}-${manifest.id}`);
    await mkdir(localRoot, { recursive: true });
    await writeFile(join(localRoot, "package.json"), '{"type":"module"}\n', "utf8");
    const entryUrl = new URL(manifest.source?.module, sourceRootUrl);
    const modules = await downloadModuleGraph(entryUrl, localRoot, manifest.id);
    const entryPath = join(localRoot, relativeSourcePath(entryUrl));
    const imported = await import(`${pathToFileURL(entryPath).href}?run=${cacheToken}`);
    const kit = imported[manifest.source?.exportName ?? "kit"] ?? imported.default;
    const result = await validateKit(manifest, kit, modules);
    results.push(result);
    console.log(`    passed ${result.services.length} services; ${result.export.format} export ${result.export.bytes} bytes`);
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}

const report = {
  schemaVersion: "nexusfactory.live-registry-validation/1",
  generatedAt: new Date().toISOString(),
  startedAt,
  registryUrl: registryUrl.href,
  registryIntegrity: snapshot.integrity,
  registrySha256: `sha256:${createHash("sha256").update(registryText).digest("hex")}`,
  domains: snapshot.domains?.length ?? 0,
  kits: snapshot.kits.length,
  passed: results.length,
  failed: 0,
  result: "PASS",
  checks: ["module-pull", "module-import", "describe", "generate", "determinism", "randomize", "reroll", "validate", "phases-when-declared", "export"],
  results,
};

if (args.report) {
  const reportPath = resolve(args.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const written = JSON.parse(await readFile(reportPath, "utf8"));
  assert(written.result === "PASS" && written.passed === snapshot.kits.length, "Written report failed verification.");
  console.log(`Report: ${reportPath}`);
}
console.log(`PASS: ${results.length}/${snapshot.kits.length} live kits imported and exercised.`);
