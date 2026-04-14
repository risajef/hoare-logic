import type { TreeNode, Statement, BuilderStatement, Expression } from './types';

export function exprToString(expr: Expression): string {
  switch (expr.type) {
    case 'var': return expr.name;
    case 'const': return expr.value.toString();
    case 'true': return 'true';
    case 'false': return 'false';
    case 'binop': {
      if (!expr.left || !expr.right) return '?';
      let op = expr.op;
      if (op === '==') op = '=';
      else if (op === '&&') op = 'and';
      else if (op === '||') op = 'or';
      return `(${op} ${exprToString(expr.left)} ${exprToString(expr.right)})`;
    }
    case 'unop': return expr.expr ? `(${expr.op === '!' ? 'not' : expr.op} ${exprToString(expr.expr)})` : '?';
  }
}

export function exprToSmt(expr: Expression): string {
  switch (expr.type) {
    case 'var':
      return expr.name;
    case 'const':
      return expr.value.toString();
    case 'true':
      return 'true';
    case 'false':
      return 'false';
    case 'binop': {
      if (!expr.left || !expr.right) {
        throw new Error('Incomplete binary expression cannot be translated to SMT');
      }

      let op = expr.op;
      if (op === '==') op = '=';
      else if (op === '&&' || op === '∧') op = 'and';
      else if (op === '||' || op === '∨') op = 'or';
      else if (op === '≤') op = '<=';
      else if (op === '≥') op = '>=';

      return `(${op} ${exprToSmt(expr.left)} ${exprToSmt(expr.right)})`;
    }
    case 'unop': {
      if (!expr.expr) {
        throw new Error('Incomplete unary expression cannot be translated to SMT');
      }

      const op = expr.op === '!' || expr.op === '¬' ? 'not' : expr.op;
      return `(${op} ${exprToSmt(expr.expr)})`;
    }
  }
}

export type SmtSort = 'Int' | 'Bool';

function setVariableSort(varSorts: Map<string, SmtSort>, name: string, sort: SmtSort): void {
  const existing = varSorts.get(name);
  if (existing && existing !== sort) {
    throw new Error(`Variable ${name} is used as both ${existing} and ${sort}`);
  }
  varSorts.set(name, sort);
}

function detectExpressionSort(expr: Expression, varSorts: Map<string, SmtSort>): SmtSort | null {
  switch (expr.type) {
    case 'const':
      return 'Int';
    case 'true':
    case 'false':
      return 'Bool';
    case 'var':
      return varSorts.get(expr.name) ?? null;
    case 'unop':
      return expr.op === '!' || expr.op === '¬' ? 'Bool' : null;
    case 'binop': {
      if (['+', '-', '*'].includes(expr.op)) return 'Int';
      if (['==', '<', '>', '≤', '≥', '&&', '∧', '||', '∨'].includes(expr.op)) return 'Bool';
      return null;
    }
  }
}

function constrainExpression(expr: Expression, expectedSort: SmtSort, varSorts: Map<string, SmtSort>): void {
  switch (expr.type) {
    case 'var':
      setVariableSort(varSorts, expr.name, expectedSort);
      return;
    case 'const':
      if (expectedSort !== 'Int') {
        throw new Error(`Numeric constant ${expr.value} cannot be used as ${expectedSort}`);
      }
      return;
    case 'true':
    case 'false':
      if (expectedSort !== 'Bool') {
        throw new Error(`Boolean literal ${expr.type} cannot be used as ${expectedSort}`);
      }
      return;
    case 'unop':
      if (expectedSort !== 'Bool') {
        throw new Error(`Unary operator ${expr.op} cannot produce ${expectedSort}`);
      }
      if (!expr.expr) {
        throw new Error('Unary expression is incomplete');
      }
      constrainExpression(expr.expr, 'Bool', varSorts);
      return;
    case 'binop': {
      if (!expr.left || !expr.right) {
        throw new Error('Binary expression is incomplete');
      }

      if (['+', '-', '*'].includes(expr.op)) {
        if (expectedSort !== 'Int') {
          throw new Error(`Arithmetic operator ${expr.op} cannot produce ${expectedSort}`);
        }
        constrainExpression(expr.left, 'Int', varSorts);
        constrainExpression(expr.right, 'Int', varSorts);
        return;
      }

      if (['<', '>', '≤', '≥'].includes(expr.op)) {
        if (expectedSort !== 'Bool') {
          throw new Error(`Comparison operator ${expr.op} cannot produce ${expectedSort}`);
        }
        constrainExpression(expr.left, 'Int', varSorts);
        constrainExpression(expr.right, 'Int', varSorts);
        return;
      }

      if (['&&', '∧', '||', '∨'].includes(expr.op)) {
        if (expectedSort !== 'Bool') {
          throw new Error(`Logical operator ${expr.op} cannot produce ${expectedSort}`);
        }
        constrainExpression(expr.left, 'Bool', varSorts);
        constrainExpression(expr.right, 'Bool', varSorts);
        return;
      }

      if (expr.op === '==') {
        if (expectedSort !== 'Bool') {
          throw new Error('Equality cannot produce Int');
        }

        const operandSort = detectExpressionSort(expr.left, varSorts)
          ?? detectExpressionSort(expr.right, varSorts)
          ?? 'Int';

        constrainExpression(expr.left, operandSort, varSorts);
        constrainExpression(expr.right, operandSort, varSorts);
        return;
      }

      throw new Error(`Unsupported operator ${expr.op}`);
    }
  }
}

export function inferVariableSorts(expr: Expression): Map<string, SmtSort> {
  const varSorts = new Map<string, SmtSort>();
  constrainExpression(expr, 'Bool', varSorts);
  return varSorts;
}

function tokenize(s: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === ' ') { i++; continue; }
    if (s[i] === '(') {
      let count = 1;
      let j = i + 1;
      while (j < s.length && count > 0) {
        if (s[j] === '(') count++;
        else if (s[j] === ')') count--;
        j++;
      }
      tokens.push(s.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < s.length && s[j] !== ' ' && s[j] !== '(' && s[j] !== ')') j++;
      tokens.push(s.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

export function parseExpression(str: string): Expression | null {
  str = str.trim();
  if (str === 'true') return { type: 'true' };
  if (str === 'false') return { type: 'false' };
  if (!isNaN(Number(str))) return { type: 'const', value: Number(str) };
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str)) return { type: 'var', name: str };
  if (str.startsWith('(') && str.endsWith(')')) {
    const inner = str.slice(1, -1).trim();
    const tokens = tokenize(inner);
    if (tokens.length === 0) return null;
    const op = tokens[0];
    if (op === '=' && tokens.length === 3) {
      const left = parseExpression(tokens[1]);
      const right = parseExpression(tokens[2]);
      if (left && right) return { type: 'binop', op: '==', left, right };
    } else if (op === 'and' && tokens.length === 3) {
      const left = parseExpression(tokens[1]);
      const right = parseExpression(tokens[2]);
      if (left && right) return { type: 'binop', op: '&&', left, right };
    } else if (op === 'or' && tokens.length === 3) {
      const left = parseExpression(tokens[1]);
      const right = parseExpression(tokens[2]);
      if (left && right) return { type: 'binop', op: '||', left, right };
    } else if (op === 'not' && tokens.length === 2) {
      const expr = parseExpression(tokens[1]);
      if (expr) return { type: 'unop', op: '!', expr };
    }
  }
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
    return (node.obligationsProved ?? false) && isValidProof(node.children[0]);
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

export function extractVars(expr: Expression): string[] {
  const vars = new Set<string>();
  function collect(e: Expression) {
    switch (e.type) {
      case 'var': vars.add(e.name); break;
      case 'binop': if (e.left) collect(e.left); if (e.right) collect(e.right); break;
      case 'unop': if (e.expr) collect(e.expr); break;
    }
  }
  collect(expr);
  return Array.from(vars);
}
