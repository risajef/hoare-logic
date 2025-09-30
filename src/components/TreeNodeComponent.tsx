import { useState } from 'react';
import type { TreeNode } from '../types';
import { exprToString, stmtToString, isValidProof, extractVars, parseExpression } from '../utils';
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

  const handleProve = async () => {
    const obligations: { name: string; left: string; right: string }[] = [];
    if (node.rule === 'consequence' && node.children.length === 1) {
      const child = node.children[0];
      obligations.push({ name: 'P_to_Pp', left: exprToString(node.pre), right: exprToString(child.pre) });
      obligations.push({ name: 'Qp_to_Q', left: exprToString(child.post), right: exprToString(node.post) });
    } else {
      setProveStatus('No obligations to prove for this node');
      return;
    }

    // Build SMT-LIB-like lines or a simple textual format expected by the worker
    const lines: string[] = [
      ...obligations.map(o => {
        // Extract vars from this obligation
        const leftExpr = parseExpression(o.left);
        const rightExpr = parseExpression(o.right);
        const obligationVars = new Set<string>();
        if (leftExpr) extractVars(leftExpr).forEach(v => obligationVars.add(v));
        if (rightExpr) extractVars(rightExpr).forEach(v => obligationVars.add(v));
        console.log("number of vars in obligation", obligationVars.size, leftExpr, rightExpr, o);
        if (obligationVars.size > 0) {
          const varDecls = Array.from(obligationVars).map(v => `(${v} Int)`).join(' ');
          return `; ${o.name}\n(assert (forall (${varDecls}) (or ${o.right} (not ${o.left}))))`;
        } else {
          return `; ${o.name}\n(assert (or ${o.right} (not ${o.left})))\n(check-sat)`;
        }
      })
    ];

    setProving(true);
    setProveStatus('Proving...');
    console.log('Calling tryZ3 with lines:', lines);
    try {
      const res = await tryZ3(lines);
      if (!res) {
        setProveStatus('Z3 solver not available in this deployment');
      } else if (res.status === 'Valid') {
        setProveStatus('All obligations proved (Valid)');
        onUpdateNode(path, node => ({ ...node, obligationsProved: true }));
      } else if (res.status === 'Invalid') {
        setProveStatus('At least one obligation is invalid');
      } else if (res.status === 'Unknown') {
        setProveStatus('Solver returned unknown');
      } else if (res.status === 'NoSolver') {
        setProveStatus('Z3 worker not found' + (res.errors ? ': ' + res.errors.join('; ') : ''));
      } else if (res.status === 'Timeout') {
        setProveStatus('Solver timed out');
      } else if (res.status === 'Error') {
        setProveStatus('Solver error' + (res.errors ? ': ' + res.errors.join('; ') : ''));
      } else {
        setProveStatus(`Result: ${res.status}` + (res.errors ? ': ' + res.errors.join('; ') : ''));
      }
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
