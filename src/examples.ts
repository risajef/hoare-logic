import type { Expression, Statement, TreeNode } from './types';

export type ProofExample = {
  id: string;
  title: string;
  description: string;
  root: TreeNode;
};

const variable = (name: string): Expression => ({ type: 'var', name });
const constant = (value: number): Expression => ({ type: 'const', value });
const truth = (): Expression => ({ type: 'true' });
const equal = (left: Expression, right: Expression): Expression => ({ type: 'binop', op: '==', left, right });
const andExpr = (left: Expression, right: Expression): Expression => ({ type: 'binop', op: '&&', left, right });
const plus = (left: Expression, right: Expression): Expression => ({ type: 'binop', op: '+', left, right });
const less = (left: Expression, right: Expression): Expression => ({ type: 'binop', op: '<', left, right });
const lessEqual = (left: Expression, right: Expression): Expression => ({ type: 'binop', op: '≤', left, right });
const notExpr = (expr: Expression): Expression => ({ type: 'unop', op: '!', expr });
const assignStmt = (variableName: string, expr: Expression): Statement => ({ type: 'assign', var: variableName, expr });

const assignmentAxiom: TreeNode = {
  pre: equal(constant(0), constant(0)),
  stmt: assignStmt('x', constant(0)),
  post: equal(variable('x'), constant(0)),
  rule: 'assign',
  children: [],
};

const sequenceProof: TreeNode = {
  pre: equal(constant(0), constant(0)),
  stmt: {
    type: 'sequence',
    s1: assignStmt('x', constant(0)),
    s2: assignStmt('y', variable('x')),
  },
  post: equal(variable('y'), constant(0)),
  rule: 'sequence',
  children: [
    {
      pre: equal(constant(0), constant(0)),
      stmt: assignStmt('x', constant(0)),
      post: equal(variable('x'), constant(0)),
      rule: 'assign',
      children: [],
    },
    {
      pre: equal(variable('x'), constant(0)),
      stmt: assignStmt('y', variable('x')),
      post: equal(variable('y'), constant(0)),
      rule: 'assign',
      children: [],
    },
  ],
};

const consequenceProof: TreeNode = {
  pre: truth(),
  stmt: assignStmt('x', constant(0)),
  post: equal(variable('x'), constant(0)),
  rule: 'consequence',
  obligationsProved: true,
  children: [
    {
      pre: equal(constant(0), constant(0)),
      stmt: assignStmt('x', constant(0)),
      post: equal(variable('x'), constant(0)),
      rule: 'assign',
      children: [],
    },
  ],
};

const conditionalProof: TreeNode = {
  pre: truth(),
  stmt: {
    type: 'conditional',
    cond: variable('b'),
    s1: assignStmt('x', constant(1)),
    s2: assignStmt('x', constant(0)),
  },
  post: truth(),
  rule: 'conditional',
  children: [
    {
      pre: andExpr(truth(), variable('b')),
      stmt: assignStmt('x', constant(1)),
      post: truth(),
      rule: 'consequence',
      obligationsProved: true,
      children: [
        {
          pre: truth(),
          stmt: assignStmt('x', constant(1)),
          post: truth(),
          rule: 'assign',
          children: [],
        },
      ],
    },
    {
      pre: andExpr(truth(), notExpr(variable('b'))),
      stmt: assignStmt('x', constant(0)),
      post: truth(),
      rule: 'consequence',
      obligationsProved: true,
      children: [
        {
          pre: truth(),
          stmt: assignStmt('x', constant(0)),
          post: truth(),
          rule: 'assign',
          children: [],
        },
      ],
    },
  ],
};

const whileProof: TreeNode = {
  pre: truth(),
  stmt: {
    type: 'sequence',
    s1: assignStmt('x', constant(0)),
    s2: {
      type: 'while',
      cond: less(variable('x'), constant(10)),
      body: assignStmt('x', plus(variable('x'), constant(1))),
    },
  },
  post: equal(variable('x'), constant(10)),
  rule: 'sequence',
  children: [
    {
      pre: truth(),
      stmt: assignStmt('x', constant(0)),
      post: equal(variable('x'), constant(0)),
      rule: 'consequence',
      obligationsProved: true,
      children: [
        {
          pre: equal(constant(0), constant(0)),
          stmt: assignStmt('x', constant(0)),
          post: equal(variable('x'), constant(0)),
          rule: 'assign',
          children: [],
        },
      ],
    },
    {
      pre: equal(variable('x'), constant(0)),
      stmt: {
        type: 'while',
        cond: less(variable('x'), constant(10)),
        body: assignStmt('x', plus(variable('x'), constant(1))),
      },
      post: equal(variable('x'), constant(10)),
      rule: 'consequence',
      obligationsProved: true,
      children: [
        {
          pre: lessEqual(constant(0), variable('x')),
          stmt: {
            type: 'while',
            cond: less(variable('x'), constant(10)),
            body: assignStmt('x', plus(variable('x'), constant(1))),
          },
          post: equal(variable('x'), constant(10)),
          rule: 'while',
          children: [
            {
              pre: andExpr(
                lessEqual(constant(0), variable('x')),
                less(variable('x'), constant(10)),
              ),
              stmt: assignStmt('x', plus(variable('x'), constant(1))),
              post: lessEqual(constant(0), variable('x')),
              rule: 'consequence',
              obligationsProved: true,
              children: [
                {
                  pre: lessEqual(constant(0), plus(variable('x'), constant(1))),
                  stmt: assignStmt('x', plus(variable('x'), constant(1))),
                  post: lessEqual(constant(0), variable('x')),
                  rule: 'assign',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const proofExamples: ProofExample[] = [
  {
    id: 'assign-axiom',
    title: 'Assignment axiom',
    description: 'A single-node proof that shows how the assignment rule discharges a substitution directly.',
    root: assignmentAxiom,
  },
  {
    id: 'sequence',
    title: 'Sequence of assignments',
    description: 'A two-step proof tree showing how a sequence splits into two assignment obligations.',
    root: sequenceProof,
  },
  {
    id: 'consequence',
    title: 'Consequence on assignment',
    description: 'A consequence node wrapped around an assignment leaf so you can inspect obligation handling.',
    root: consequenceProof,
  },
  {
    id: 'conditional',
    title: 'Conditional with two branches',
    description: 'A branching example that visualizes how conditionals create two subproofs.',
    root: conditionalProof,
  },
  {
    id: 'while',
    title: 'Count To Ten Loop',
    description: 'A worked proof for x := 0; while x < 10 do x := x + 1, including the sequence, consequence, and loop-invariant steps.',
    root: whileProof,
  },
];