import { useEffect, useState } from 'react';
import type { Expression, TreeNode } from '../types';
import { exprToSmt, exprToString, inferVariableSorts, stmtToString, isValidProof } from '../utils';
import { tryZ3 } from '../z3';

interface TreeNodeComponentProps {
  node: TreeNode;
  path?: number[];
  onApplyRule: (path: number[], node: TreeNode, rule: string) => string | null;
  onRemoveRule: (path: number[]) => void;
  onUpdateNode: (path: number[], updater: (node: TreeNode) => TreeNode) => void;
}

const ruleLabel: Record<string, string> = {
  skip: 'Skip',
  assign: 'Assign',
  sequence: 'Sequence',
  conditional: 'Conditional',
  consequence: 'Consequence',
  while: 'While',
};

const getPrimaryRuleForStatement = (type: TreeNode['stmt']['type']): string => {
  if (type === 'skip') return 'skip';
  if (type === 'assign') return 'assign';
  if (type === 'sequence') return 'sequence';
  if (type === 'conditional') return 'conditional';
  return 'while';
};

function TreeNodeComponent({ node, path = [], onApplyRule, onRemoveRule, onUpdateNode }: TreeNodeComponentProps) {
  const isValid = isValidProof(node);
  const [proveStatus, setProveStatus] = useState<string | null>(null);
  const [proving, setProving] = useState(false);
  const [ruleStatus, setRuleStatus] = useState<string | null>(null);
  const relevantRules = [getPrimaryRuleForStatement(node.stmt.type), 'consequence'];
  const showProveButton = node.rule === 'consequence' && node.children.length === 1;
  const showRuleButtons = !node.rule || showProveButton;

  useEffect(() => {
    setProveStatus(null);
    setProving(false);
  }, [node.rule, node.children.length]);

  useEffect(() => {
    setRuleStatus(null);
  }, [node.rule, node.children.length]);

  const handleApplyRule = (rule: string) => {
    const error = onApplyRule(path, node, rule);
    setRuleStatus(error);
  };

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
      <div className="tree-node-header">
        <p className="node-judgement">{`{${exprToString(node.pre)}} ${stmtToString(node.stmt)} {${exprToString(node.post)}}`}</p>
        <div className="rule-badge-row">
          {node.rule ? (
            <span className="rule-badge">Rule: {ruleLabel[node.rule] ?? node.rule}</span>
          ) : (
            <span className="rule-badge pending">Select a rule</span>
          )}
          {node.rule && (
            <button
              type="button"
              className="rule-remove-x"
              aria-label="Remove rule"
              title="Remove rule"
              onClick={() => { setRuleStatus(null); onRemoveRule(path); }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {node.rule === 'consequence' && node.children.length === 1 && (
        <p className="obligation-summary">Obligations: {exprToString(node.pre)} ⇒ {exprToString(node.children[0].pre)} and {exprToString(node.children[0].post)} ⇒ {exprToString(node.post)}</p>
      )}
      {showRuleButtons && (
        <div className="rule-buttons">
          {!node.rule && relevantRules.map((rule) => (
            <button key={rule} className="btn-small" onClick={() => handleApplyRule(rule)}>{ruleLabel[rule] ?? rule}</button>
          ))}
          {showProveButton && (
            <button className="btn-small" onClick={handleProve} disabled={proving}>{proving ? 'Proving...' : 'Prove obligations'}</button>
          )}
        </div>
      )}
      {ruleStatus && <p className="rule-apply-status">{ruleStatus}</p>}
      {proveStatus && <p className="prove-status">{proveStatus}</p>}
      {node.children.length > 0 && (
        <div className="children">
          {node.children.map((child, i) => (
            <TreeNodeComponent
              key={i}
              node={child}
              path={[...path, i]}
              onApplyRule={onApplyRule}
              onRemoveRule={onRemoveRule}
              onUpdateNode={onUpdateNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TreeNodeComponent;
