export type Expression = string;

export type Statement =
  | { type: 'skip' }
  | { type: 'assign'; var: string; expr: Expression }
  | { type: 'sequence'; s1: Statement; s2: Statement }
  | { type: 'conditional'; cond: Expression; s1: Statement; s2: Statement }
  | { type: 'while'; cond: Expression; body: Statement };

export type TreeNode = {
  pre: string;
  stmt: Statement;
  post: string;
  children: TreeNode[];
  rule?: string;
};

export type BuilderStatement = 
  | { type: 'skip' }
  | { type: 'assign'; var: string; expr: string }
  | { type: 'sequence'; s1: BuilderStatement | null; s2: BuilderStatement | null }
  | { type: 'conditional'; cond: string; s1: BuilderStatement | null; s2: BuilderStatement | null }
  | { type: 'while'; cond: string; body: BuilderStatement | null };
