export type Expression =
  | { type: 'var'; name: string }
  | { type: 'const'; value: number }
  | { type: 'true' }
  | { type: 'false' }
  | { type: 'binop'; op: string; left: Expression | null; right: Expression | null }
  | { type: 'unop'; op: string; expr: Expression | null };

export type Statement =
  | { type: 'skip' }
  | { type: 'assign'; var: string; expr: Expression }
  | { type: 'sequence'; s1: Statement; s2: Statement }
  | { type: 'conditional'; cond: Expression; s1: Statement; s2: Statement }
  | { type: 'while'; cond: Expression; body: Statement };

export type TreeNode = {
  pre: Expression;
  stmt: Statement;
  post: Expression;
  children: TreeNode[];
  rule?: string;
  obligationsProved?: boolean;
};

export type BuilderStatement = 
  | { type: 'skip' }
  | { type: 'assign'; var: string; expr: Expression | null }
  | { type: 'sequence'; s1: BuilderStatement | null; s2: BuilderStatement | null }
  | { type: 'conditional'; cond: Expression | null; s1: BuilderStatement | null; s2: BuilderStatement | null }
  | { type: 'while'; cond: Expression | null; body: BuilderStatement | null };
