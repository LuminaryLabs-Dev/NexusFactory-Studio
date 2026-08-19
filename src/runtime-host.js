export class RuntimeHost {
  constructor(registryHost) {
    if (!registryHost?.loadKit) throw new TypeError("RuntimeHost requires a RegistryHost.");
    this.registry = registryHost;
  }

  async invoke(kitId, service, ...args) {
    const kit = await this.registry.loadKit(kitId);
    const fn = kit.services?.[service];
    if (typeof fn !== "function") throw new RangeError(`Kit ${kitId} does not provide service ${service}.`);
    return fn(...args);
  }

  describe(kitId) { return this.invoke(kitId, "describe"); }
  generate(kitId, request) { return this.invoke(kitId, "generate", request); }
  reroll(kitId, request) { return this.invoke(kitId, "reroll", request); }
  validate(kitId, artifact) { return this.invoke(kitId, "validate", artifact); }
  exportArtifact(kitId, artifact, format) { return this.invoke(kitId, "export", artifact, format); }
}
