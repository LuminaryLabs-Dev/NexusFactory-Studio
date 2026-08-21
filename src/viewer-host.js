import { resolvePreviewType } from "./viewer-contract.js";

export class ViewerHost {
  constructor(container, factories = {}) {
    if (!container?.replaceChildren) throw new TypeError("ViewerHost requires a DOM-like container.");
    this.container = container;
    this.factories = { ...factories };
    this.viewer = null;
    this.type = null;
  }

  show(preview, artifact) {
    const type = resolvePreviewType(preview);
    const factory = type ? this.factories[type] : null;
    if (typeof factory !== "function") {
      this.dispose();
      this.container.replaceChildren();
      return { supported: false, type: String(preview ?? "none") };
    }
    if (!this.viewer || this.type !== type) {
      this.dispose();
      this.container.replaceChildren();
      this.viewer = factory(this.container);
      if (!this.viewer || typeof this.viewer.show !== "function") throw new TypeError(`Viewer factory for ${type} must return an object with show().`);
      this.type = type;
    }
    this.viewer.show(artifact);
    return { supported: true, type };
  }

  async snapshot(type = "image/png") {
    if (!this.viewer || typeof this.viewer.snapshot !== "function") throw new Error("Current viewer does not support snapshots.");
    return this.viewer.snapshot(type);
  }

  dispose() {
    this.viewer?.dispose?.();
    this.viewer = null;
    this.type = null;
  }
}
