import test from "node:test";
import assert from "node:assert/strict";
import { choiceOptions, isChoiceParameter, randomControlValue } from "../src/control-value.js";

test("enum parameters expose labeled choices", () => {
  const param = { id: "shape", type: "enum", options: ["rounded", "broad"], optionLabels: { rounded: "Rounded", broad: "Broad" }, default: "rounded" };
  assert.equal(isChoiceParameter(param), true);
  assert.deepEqual(choiceOptions(param), [{ value: "rounded", label: "Rounded" }, { value: "broad", label: "Broad" }]);
  assert.equal(randomControlValue(param, () => 0.99), "broad");
});

test("numeric randomization remains bounded", () => {
  const param = { id: "count", type: "integer", minimum: 4, maximum: 6, default: 5, step: 1 };
  assert.equal(randomControlValue(param, () => 0), 4);
  assert.equal(randomControlValue(param, () => 0.99), 6);
});
