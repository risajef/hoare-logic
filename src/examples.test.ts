import assert from 'node:assert/strict';
import test from 'node:test';
import { proofExamples } from './examples';
import { isValidProof } from './utils';

test('the worked loop, nontermination, and false-precondition examples are valid', () => {
  for (const id of ['while', 'non-negative-loop-contradiction', 'false-implies-anything']) {
    const example = proofExamples.find((candidate) => candidate.id === id);
    assert.ok(example, `${id} should be bundled`);
    assert.equal(isValidProof(example.root), true, id);
  }
});
