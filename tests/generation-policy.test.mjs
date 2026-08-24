import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationGate, generationDelay } from '../src/generation-policy.js';

test('generation policy uses manifest debounce and rejects stale tokens',()=>{
  assert.equal(generationDelay({generation:{debounceMs:420}}),420);
  assert.equal(generationDelay({generation:{debounceMs:9000}}),5000);
  const gate=createGenerationGate(),first=gate.begin();
  assert.equal(gate.isCurrent(first),true);
  const second=gate.begin();
  assert.equal(gate.isCurrent(first),false);
  assert.equal(gate.isCurrent(second),true);
  gate.invalidate();
  assert.equal(gate.isCurrent(second),false);
});
