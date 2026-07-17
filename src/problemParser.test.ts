import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProblem } from './problemParser';

test('parses the requested while-loop problem', () => {
  assert.deepEqual(
    parseProblem('{(= x 0)} while (≤ 0 x) do x := (+ x 1) {(< x 0)}'),
    {
      pre: { type: 'binop', op: '==', left: { type: 'var', name: 'x' }, right: { type: 'const', value: 0 } },
      stmt: {
        type: 'while',
        cond: { type: 'binop', op: '≤', left: { type: 'const', value: 0 }, right: { type: 'var', name: 'x' } },
        body: {
          type: 'assign',
          var: 'x',
          expr: { type: 'binop', op: '+', left: { type: 'var', name: 'x' }, right: { type: 'const', value: 1 } },
        },
      },
      post: { type: 'binop', op: '<', left: { type: 'var', name: 'x' }, right: { type: 'const', value: 0 } },
    },
  );
});

test('parses sequences, conditionals, and boolean aliases', () => {
  assert.deepEqual(
    parseProblem('{true} if (and true (not false)) then x := 1; y := x else skip {true}').stmt,
    {
      type: 'conditional',
      cond: {
        type: 'binop',
        op: '∧',
        left: { type: 'true' },
        right: { type: 'unop', op: '¬', expr: { type: 'false' } },
      },
      s1: {
        type: 'sequence',
        s1: { type: 'assign', var: 'x', expr: { type: 'const', value: 1 } },
        s2: { type: 'assign', var: 'y', expr: { type: 'var', name: 'x' } },
      },
      s2: { type: 'skip' },
    },
  );
});

test('rejects incomplete problems', () => {
  assert.throws(() => parseProblem('{true} x := 1'), /postcondition/);
});
