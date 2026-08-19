import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RegistryHost } from "../src/registry-host.js";
import { RuntimeHost } from "../src/runtime-host.js";
import { deriveEditorModel } from "../src/editor-contract.js";

const registryUrl = new URL("./fixtures/registry.json", import.meta.url).href;
const snapshot = JSON.parse(await readFile(new URL("./fixtures/registry.json", import.meta.url), "utf8"));

test("Studio host loads a registry without generator-specific knowledge", async () => {
  const host = new RegistryHost();
  host.loadSnapshot(snapshot, registryUrl);
  assert.equal(host.listDomains().length, 2);
  assert.equal(host.listKits().length, 1);
  assert.equal(host.domainTree()[0].children[0].kits[0].id, "mock-kit");
  const runtime = new RuntimeHost(host);
  const generated = await runtime.generate("mock-kit", { seed: "abc", params: { size: 2 } });
  assert.equal(generated.marker, "generated");
  assert.deepEqual(await runtime.validate("mock-kit", generated), { valid: true });
  assert.equal(await runtime.exportArtifact("mock-kit", generated, "glb"), "glb");
});

test("editor surfaces are derived from kit capabilities", () => {
  const model = deriveEditorModel(snapshot.kits[0]);
  assert.equal(model.preview, "mesh-3d");
  assert.equal(model.showSeed, true);
  assert.equal(model.showExport, true);
  assert.deepEqual(model.exportFormats, ["glb"]);
  assert.equal(model.parameters[0].id, "size");
});

test("invalid capability graph is rejected", () => {
  const host = new RegistryHost();
  assert.throws(() => host.loadSnapshot({ ...snapshot, capabilityGraph: { valid: false, missing: [{ id: "x", token: "y" }] } }, registryUrl), /capability graph is invalid/);
});
