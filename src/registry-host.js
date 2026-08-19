const REGISTRY_SCHEMA = "nexusfactory.registry/1";

function clone(value) { return structuredClone(value); }

function assertSnapshot(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== REGISTRY_SCHEMA) throw new TypeError(`Unsupported registry schema: ${snapshot?.schemaVersion ?? "missing"}`);
  if (!Array.isArray(snapshot.domains) || !Array.isArray(snapshot.kits)) throw new TypeError("Registry requires domains[] and kits[].");
  if (!snapshot.capabilityGraph?.valid) {
    const missing = snapshot.capabilityGraph?.missing ?? [];
    throw new TypeError(`Registry capability graph is invalid: ${JSON.stringify(missing)}`);
  }
  const domainPaths = new Set(snapshot.domains.map((domain) => domain.domainPath));
  for (const kit of snapshot.kits) if (!domainPaths.has(kit.domainPath)) throw new TypeError(`Kit ${kit.id} references missing domain ${kit.domainPath}`);
  return snapshot;
}

export class RegistryHost {
  constructor({ fetcher = globalThis.fetch?.bind(globalThis), importer = (url) => import(url) } = {}) {
    this.fetcher = fetcher;
    this.importer = importer;
    this.registryUrl = null;
    this.snapshotValue = null;
    this.moduleCache = new Map();
  }

  async load(registryUrl) {
    if (!this.fetcher) throw new TypeError("RegistryHost requires fetch support.");
    const response = await this.fetcher(registryUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Registry request failed (${response.status}) for ${registryUrl}`);
    return this.loadSnapshot(await response.json(), registryUrl);
  }

  loadSnapshot(snapshot, registryUrl = "file:///registry.json") {
    this.snapshotValue = clone(assertSnapshot(snapshot));
    this.registryUrl = String(registryUrl);
    this.moduleCache.clear();
    return this.snapshot();
  }

  snapshot() {
    if (!this.snapshotValue) throw new Error("No registry loaded.");
    return clone(this.snapshotValue);
  }

  listDomains() { return this.snapshot().domains; }
  listKits() { return this.snapshot().kits; }
  getKit(id) { return this.listKits().find((kit) => kit.id === String(id)) ?? null; }
  getDomainByPath(path) { return this.listDomains().find((domain) => domain.domainPath === String(path)) ?? null; }

  kitsForDomain(domainPath, { includeChildren = false } = {}) {
    const path = String(domainPath);
    return this.listKits().filter((kit) => includeChildren ? (kit.domainPath === path || kit.domainPath.startsWith(`${path}:`)) : kit.domainPath === path);
  }

  domainTree() {
    const domains = this.listDomains();
    const byParent = new Map();
    for (const domain of domains) {
      const key = domain.parentDomainPath ?? "__root__";
      byParent.set(key, [...(byParent.get(key) ?? []), domain]);
    }
    const build = (parent) => (byParent.get(parent) ?? []).sort((a, b) => a.domainPath.localeCompare(b.domainPath)).map((domain) => ({
      domain,
      kits: this.kitsForDomain(domain.domainPath),
      children: build(domain.domainPath)
    }));
    return build("__root__");
  }

  resolveModuleUrl(manifest) {
    const modulePath = manifest?.source?.module;
    if (!modulePath) throw new TypeError(`Kit ${manifest?.id ?? "unknown"} does not declare source.module.`);
    return new URL(modulePath, this.registryUrl).href;
  }

  async loadKit(id) {
    const manifest = this.getKit(id);
    if (!manifest) throw new RangeError(`Unknown kit: ${id}`);
    if (this.moduleCache.has(manifest.id)) return this.moduleCache.get(manifest.id);
    const url = this.resolveModuleUrl(manifest);
    const module = await this.importer(url);
    const exportName = manifest.source?.exportName ?? "kit";
    const kit = module[exportName] ?? module.default;
    if (!kit?.services) throw new TypeError(`Kit module ${url} does not expose ${exportName}.services.`);
    if (kit.manifest?.id && kit.manifest.id !== manifest.id) throw new TypeError(`Kit manifest mismatch: registry=${manifest.id}, module=${kit.manifest.id}`);
    this.moduleCache.set(manifest.id, kit);
    return kit;
  }
}
