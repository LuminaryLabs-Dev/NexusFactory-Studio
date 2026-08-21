import test from "node:test";
import assert from "node:assert/strict";
import { choiceOptions, isChoiceParameter } from "../src/control-value.js";

test("enum parameters expose labeled choices", () => {
  const param = { id: "shape", type: "enum", options: ["rounded", "broad"], optionLabels: { rounded: "Rounded", broad: "Broad" }, default: "rounded" };
  assert.equal(isChoiceParameter(param), true);
  assert.deepEqual(choiceOptions(param), [{ value: "rounded", label: "Rounded" }, { value: "broad", label: "Broad" }]);
});

test("numeric parameters are not treated as choices", () => {
  assert.equal(isChoiceParameter({ id: "count", type: "integer", minimum: 4, maximum: 6 }), false);
});
