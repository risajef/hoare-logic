import { useState } from 'react';
import type { Expression, TreeNode } from '../types';
import { exprToSmt, exprToString, inferVariableSorts, stmtToString, isValidProof } from '../utils';
import { tryZ3 } from '../z3';

interface TreeNodeComponentProps {
  node: TreeNode;
  path?: number[];
  onApplyRule: (path: number[], node: TreeNode, rule: string) => void;
  onUpdateNode: (path: number[], updater: (node: TreeNode) => TreeNode) => void;
}

function TreeNodeComponent({ node, path = [], onApplyRule, onUpdateNode }: TreeNodeComponentProps) {
  const isValid = isValidProof(node);
  const [proveStatus, setProveStatus] = useState<string | null>(null);
  const [proving, setProving] = useState(false);

  const buildObligationQuery = (name: string, left: Expression, right: Expression): string[] => {
    const varSorts = new Map<string, 'Int' | 'Bool'>();
    inferVariableSorts(left).forEach((sort, variableName) => varSorts.set(variableName, sort));
    inferVariableSorts(right).forEach((sort, variableName) => {
      const existing = varSorts.get(variableName);
      if (existing && existing !== sort) {
        throw new Error(`Variable ${variableName} is used as both ${existing} and ${sort}`);
      }
      varSorts.set(variableName, sort);
    });

    const declarations = Array.from(varSorts.entries())
      .sort()
      .map(([variableName, sort]) => `(declare-const ${variableName} ${sort})`);

    return [
      '; ' + name,
      ...declarations,
      `(assert (not (=> ${exprToSmt(left)} ${exprToSmt(right)})))`,
      '(check-sat)',
    ];
  };

  const handleProve = async () => {
    const obligations: { name: string; left: Expression; right: Expression }[] = [];
    if (node.rule === 'consequence' && node.children.length === 1) {
      const child = node.children[0];
      obligations.push({ name: 'P_to_Pp', left: node.pre, right: child.pre });
      obligations.push({ name: 'Qp_to_Q', left: child.post, right: node.post });
    } else {
      setProveStatus('No obligations to prove for this node');
      return;
    }

    setProving(true);
    setProveStatus('Proving...');

    try {
      for (const obligation of obligations) {
        const res = await tryZ3(buildObligationQuery(obligation.name, obligation.left, obligation.right));

        if (!res) {
          setProveStatus('Z3 solver not available in this deployment');
          return;
        }

        if (res.status === 'NoSolver') {
          setProveStatus('Z3 worker not found' + (res.errors ? ': ' + res.errors.join('; ') : ''));
          return;
        }

        if (res.status === 'Timeout') {
          setProveStatus(`Solver timed out while checking ${obligation.name}`);
          return;
        }

        if (res.status === 'Error') {
          setProveStatus('Solver error' + (res.errors ? ': ' + res.errors.join('; ') : ''));
          return;
        }

        if (res.status === 'Sat') {
          setProveStatus(`Obligation ${obligation.name} is not valid`);
          return;
        }

        if (res.status !== 'Unsat') {
          setProveStatus(`Solver returned ${res.status} for ${obligation.name}` + (res.errors ? ': ' + res.errors.join('; ') : ''));
          return;
        }
      }

      setProveStatus('All obligations proved (Valid)');
      onUpdateNode(path, currentNode => ({ ...currentNode, obligationsProved: true }));
    } catch (err: any) {
      setProveStatus('Error running solver: ' + (err?.message || String(err)));
    } finally {
      setProving(false);
    }
  };

  return (
    <div className={`tree-node ${isValid ? '' : 'invalid-node'}`}>
      <p>{`{${exprToString(node.pre)}} ${stmtToString(node.stmt)} {${exprToString(node.post)}}`}</p>
      {node.rule && <p>Rule: {node.rule}</p>}
      {node.rule === 'consequence' && node.children.length === 1 && (
        <p>Obligations: {exprToString(node.pre)} ⇒ {exprToString(node.children[0].pre)} and {exprToString(node.children[0].post)} ⇒ {exprToString(node.post)}</p>
      )}
      <div className="rule-buttons">
        <button className="btn-small" onClick={() => onApplyRule(path, node, 'skip')}>Skip</button>
        <button className="btn-small" onClick={() => onApplyRule(path, node, 'assign')}>Assign</button>
        <button className="btn-small" onClick={() => onApplyRule(path, node, 'sequence')}>Sequence</button>
        <button className="btn-small" onClick={() => onApplyRule(path, node, 'conditional')}>Conditional</button>
        <button className="btn-small" onClick={() => onApplyRule(path, node, 'consequence')}>Consequence</button>
        <button className="btn-small" onClick={() => onApplyRule(path, node, 'while')}>While</button>
        {node.rule === 'consequence' && node.children.length === 1 && (
          <button className="btn-small" onClick={handleProve} disabled={proving} style={{ marginLeft: 8 }}>{proving ? 'Proving...' : 'Prove obligations'}</button>
        )}
      </div>
      {proveStatus && <p style={{ marginTop: 8 }}>{proveStatus}</p>}
      <div className="children">
        {node.children.map((child, i) => (
          <TreeNodeComponent key={i} node={child} path={[...path, i]} onApplyRule={onApplyRule} onUpdateNode={onUpdateNode} />
        ))}
      </div>
    </div>
  );
}

export default TreeNodeComponent;
