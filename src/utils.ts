import type { TreeNode, Statement, BuilderStatement } from './types';

export function isAxiom(node: TreeNode): boolean {
  if (node.children.length > 0) return false;
  if (node.stmt.type === 'skip') {
    return node.pre === node.post;
  }
  if (node.stmt.type === 'assign') {
    console.log(node.pre, substitute(node.post, node.stmt.var, node.stmt.expr));
    return node.pre === substitute(node.post, node.stmt.var, node.stmt.expr);
  }
  return false;
}

export function substitute(str: string, varName: string, expr: string): string {
  // Simple replace all, assuming no conflicts
  return str.replace(new RegExp('\\b' + varName + '\\b', 'g'), expr);
}

export function isValidProof(node: TreeNode): boolean {
  if (node.children.length === 0) {
    return node.rule !== undefined && isAxiom(node);
  }
  // Check based on rule
  if (node.rule === 'sequence' && node.children.length === 2) {
    const [child1, child2] = node.children;
    return child1.pre === node.pre && child1.post === child2.pre && child2.post === node.post &&
           isValidProof(child1) && isValidProof(child2);
  }
  if (node.rule === 'conditional' && node.stmt.type === 'conditional' && node.children.length === 2) {
    const [child1, child2] = node.children;
    const normalize = (str: string) => str
      .replace(/\s+/g, '') // Remove spaces
      .replace(/¬|not/g, 'not') // Normalize not
      .replace(/∧|\band\b/g, 'and') // Normalize and
      .replace(/\(([^()]+)\)/g, '$1'); // Remove voluntary brackets

    const normalizedPre = normalize(node.pre);
    const normalizedCond = normalize(node.stmt.cond);
    const normalizedChild1Pre = normalize(child1.pre);
    const normalizedChild2Pre = normalize(child2.pre);
    const normalizedChild1Post = normalize(child1.post);
    const normalizedChild2Post = normalize(child2.post);
    const normalizedPost = normalize(node.post);

    return (normalizedChild1Pre === normalize(`${normalizedPre} and ${normalizedCond}`) &&
        normalizedChild2Pre === normalize(`not ${normalizedCond} and ${normalizedPre}`) &&
        normalizedChild1Post === normalizedPost &&
        normalizedChild2Post === normalizedPost &&
        isValidProof(child1) && isValidProof(child2));
  }
  if (node.rule === 'while' && node.stmt.type === 'while' && node.children.length === 1) {
    const child = node.children[0];
    const normalize = (str: string) => str
      .replace(/\s+/g, '') // Remove spaces
      .replace(/¬|not/g, 'not') // Normalize not
      .replace(/∧|\band\b/g, 'and') // Normalize and
      .replace(/\(([^()]+)\)/g, '$1'); // Remove voluntary brackets

    return normalize(child.pre) === normalize(`${node.pre} and ${node.stmt.cond}`) &&
         normalize(child.post) === normalize(node.pre) &&
         (normalize(node.post) === normalize(`not ${node.stmt.cond} and ${node.pre}`) ||
        normalize(node.post) === normalize(`${node.pre} and not ${node.stmt.cond}`)) &&
         isValidProof(child);
  }
  if (node.rule === 'consequence' && node.children.length === 1 && node.pre && node.post) {
    // Consequence rule: allows strengthening pre or weakening post
    // params: { newPre, newPost }
    const child = node.children[0];
    // For now, just check the structure; semantic entailment is not checked
    return isValidProof(child);
  }
  // For skip and assign, no children
  return false;
}

export function stmtToString(stmt: Statement): string {
  switch (stmt.type) {
    case 'skip': return 'skip';
    case 'assign': return `${stmt.var} := ${stmt.expr}`;
    case 'sequence': return `${stmtToString(stmt.s1)}; ${stmtToString(stmt.s2)}`;
    case 'conditional': return `if ${stmt.cond} then ${stmtToString(stmt.s1)} else ${stmtToString(stmt.s2)}`;
    case 'while': return `while ${stmt.cond} do ${stmtToString(stmt.body)}`;
  }
}

export function parseStatement(str: string): Statement | null {
  str = str.trim();
  if (str === 'skip') return { type: 'skip' };
  const assignMatch = str.match(/^(\w+)\s*:=\s*(.+)$/);
  if (assignMatch) return { type: 'assign', var: assignMatch[1], expr: assignMatch[2].trim() };
  if (str.includes(';')) {
    const parts = str.split(';').map(s => s.trim());
    if (parts.length === 2) {
      const s1 = parseStatement(parts[0]);
      const s2 = parseStatement(parts[1]);
      if (s1 && s2) return { type: 'sequence', s1, s2 };
    }
  }
  const condMatch = str.match(/^if\s+(.+)\s+then\s+(.+)\s+else\s+(.+)$/);
  if (condMatch) {
    const cond = condMatch[1].trim();
    const s1 = parseStatement(condMatch[2].trim());
    const s2 = parseStatement(condMatch[3].trim());
    if (s1 && s2) return { type: 'conditional', cond, s1, s2 };
  }
  const whileMatch = str.match(/^while\s+(.+)\s+do\s+(.+)$/);
  if (whileMatch) {
    const cond = whileMatch[1].trim();
    const body = parseStatement(whileMatch[2].trim());
    if (body) return { type: 'while', cond, body };
  }
  return null;
}

export function builderToStatement(bs: BuilderStatement | null): Statement | null {
  if (!bs) return null;
  if (bs.type === 'skip') return { type: 'skip' };
  if (bs.type === 'assign') return { type: 'assign', var: bs.var, expr: bs.expr };
  if (bs.type === 'sequence') {
    const s1 = builderToStatement(bs.s1);
    const s2 = builderToStatement(bs.s2);
    if (s1 && s2) return { type: 'sequence', s1, s2 };
  }
  if (bs.type === 'conditional') {
    const s1 = builderToStatement(bs.s1);
    const s2 = builderToStatement(bs.s2);
    if (s1 && s2) return { type: 'conditional', cond: bs.cond, s1, s2 };
  }
  if (bs.type === 'while') {
    const body = builderToStatement(bs.body);
    if (body) return { type: 'while', cond: bs.cond, body };
  }
  return null;
}
