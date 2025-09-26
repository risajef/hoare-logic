import type { TreeNode, Statement, BuilderStatement, Expression } from './types';

export function exprToString(expr: Expression): string {
  switch (expr.type) {
    case 'var': return expr.name;
    case 'const': return expr.value.toString();
    case 'true': return 'true';
    case 'false': return 'false';
    case 'binop': return expr.left && expr.right ? `(${exprToString(expr.left)} ${expr.op === '==' ? '=' : expr.op} ${exprToString(expr.right)})` : '?';
    case 'unop': return expr.expr ? `${expr.op === '!' ? 'not' : expr.op}${exprToString(expr.expr)}` : '?';
  }
}

export function parseExpression(str: string): Expression | null {
  str = str.trim();
  // Replace readable operators with symbols
  str = str.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!').replace(/ = /g, ' == ');
  if (str === 'true') return { type: 'true' };
  if (str === 'false') return { type: 'false' };
  if (!isNaN(Number(str))) return { type: 'const', value: Number(str) };
  // Simple binop, last occurrence
  const ops = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/'];
  for (const op of ops) {
    const index = str.lastIndexOf(op);
    if (index > 0 && index < str.length - op.length) {
      const leftStr = str.slice(0, index).trim();
      const rightStr = str.slice(index + op.length).trim();
      const left = parseExpression(leftStr);
      const right = parseExpression(rightStr);
      if (left && right) return { type: 'binop', op, left, right };
    }
  }
  // unop
  if (str.startsWith('!')) {
    const exprStr = str.slice(1).trim();
    const expr = parseExpression(exprStr);
    if (expr) return { type: 'unop', op: '!', expr };
  }
  // var
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str)) return { type: 'var', name: str };
  return null;
}

export function exprEqual(a: Expression, b: Expression): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'var': return a.name === (b as any).name;
    case 'const': return a.value === (b as any).value;
    case 'true':
    case 'false': return true;
    case 'binop': {
      const bBinop = b as any;
      return a.op === bBinop.op &&
             ((a.left === null && bBinop.left === null) || (a.left && bBinop.left && exprEqual(a.left, bBinop.left))) &&
             ((a.right === null && bBinop.right === null) || (a.right && bBinop.right && exprEqual(a.right, bBinop.right)));
    }
    case 'unop': {
      const bUnop = b as any;
      return a.op === bUnop.op &&
             ((a.expr === null && bUnop.expr === null) || (a.expr && bUnop.expr && exprEqual(a.expr, bUnop.expr)));
    }
  }
  return false;
}

export function exprSubstitute(expr: Expression, varName: string, replacement: Expression): Expression {
  if (expr.type === 'var' && expr.name === varName) return replacement;
  if (expr.type === 'const' || expr.type === 'true' || expr.type === 'false') return expr;
  if (expr.type === 'binop') return { type: 'binop', op: expr.op, left: expr.left ? exprSubstitute(expr.left, varName, replacement) : null, right: expr.right ? exprSubstitute(expr.right, varName, replacement) : null };
  if (expr.type === 'unop') return { type: 'unop', op: expr.op, expr: expr.expr ? exprSubstitute(expr.expr, varName, replacement) : null };
  return expr;
}

export function isAxiom(node: TreeNode): boolean {
  if (node.children.length > 0) return false;
  if (node.stmt.type === 'skip') {
    return exprEqual(node.pre, node.post);
  }
  if (node.stmt.type === 'assign') {
    return exprEqual(node.pre, exprSubstitute(node.post, node.stmt.var, node.stmt.expr));
  }
  return false;
}

export function isValidProof(node: TreeNode): boolean {
  if (node.children.length === 0) {
    return node.rule !== undefined && isAxiom(node);
  }
  // Check based on rule
  if (node.rule === 'sequence' && node.children.length === 2) {
    const [child1, child2] = node.children;
    return exprEqual(child1.pre, node.pre) && exprEqual(child1.post, child2.pre) && exprEqual(child2.post, node.post) &&
           isValidProof(child1) && isValidProof(child2);
  }
  if (node.rule === 'conditional' && node.stmt.type === 'conditional' && node.children.length === 2) {
    const [child1, child2] = node.children;
    return exprEqual(child1.pre, { type: 'binop', op: '&&', left: node.pre, right: node.stmt.cond }) &&
           exprEqual(child2.pre, { type: 'binop', op: '&&', left: node.pre, right: { type: 'unop', op: '!', expr: node.stmt.cond } }) &&
           exprEqual(child1.post, node.post) && exprEqual(child2.post, node.post) &&
           isValidProof(child1) && isValidProof(child2);
  }
  if (node.rule === 'while' && node.stmt.type === 'while' && node.children.length === 1) {
    const child = node.children[0];
    return exprEqual(child.pre, { type: 'binop', op: '&&', left: node.pre, right: node.stmt.cond }) &&
           exprEqual(child.post, node.pre) &&
           isValidProof(child);
  }
  if (node.rule === 'consequence' && node.children.length === 1) {
    return isValidProof(node.children[0]);
  }
  // For skip and assign, no children
  return false;
}

export function stmtToString(stmt: Statement): string {
  switch (stmt.type) {
    case 'skip': return 'skip';
    case 'assign': return `${stmt.var} := ${exprToString(stmt.expr)}`;
    case 'sequence': return `${stmtToString(stmt.s1)}; ${stmtToString(stmt.s2)}`;
    case 'conditional': return `if ${exprToString(stmt.cond)} then ${stmtToString(stmt.s1)} else ${stmtToString(stmt.s2)}`;
    case 'while': return `while ${exprToString(stmt.cond)} do ${stmtToString(stmt.body)}`;
  }
}

export function builderToStatement(bs: BuilderStatement | null): Statement | null {
  if (!bs) return null;
  if (bs.type === 'skip') return { type: 'skip' };
  if (bs.type === 'assign' && bs.expr) return { type: 'assign', var: bs.var, expr: bs.expr };
  if (bs.type === 'sequence') {
    const s1 = builderToStatement(bs.s1);
    const s2 = builderToStatement(bs.s2);
    if (s1 && s2) return { type: 'sequence', s1, s2 };
  }
  if (bs.type === 'conditional' && bs.cond) {
    const s1 = builderToStatement(bs.s1);
    const s2 = builderToStatement(bs.s2);
    if (s1 && s2) return { type: 'conditional', cond: bs.cond, s1, s2 };
  }
  if (bs.type === 'while' && bs.cond) {
    const body = builderToStatement(bs.body);
    if (body) return { type: 'while', cond: bs.cond, body };
  }
  return null;
}

export function isComplete(expr: Expression | null): boolean {
  if (!expr) return false;
  if (expr.type === 'var' || expr.type === 'const' || expr.type === 'true' || expr.type === 'false') return true;
  if (expr.type === 'binop') return isComplete(expr.left) && isComplete(expr.right);
  if (expr.type === 'unop') return isComplete(expr.expr);
  return false;
}
