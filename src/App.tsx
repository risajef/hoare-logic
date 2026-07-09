import { useState, useEffect } from 'react';
import type { TreeNode, BuilderStatement, Expression } from './types';
import { isValidProof, builderToStatement, statementToBuilder, isComplete, exprEqual, exprSubstitute, exprToString } from './utils';
import TreeNodeComponent from './components/TreeNodeComponent';
import ExpressionBuilder from './components/ExpressionBuilder';
import StatementBuilder from './components/StatementBuilder';
import IntermediateModal from './components/IntermediateModal';
import ConsequenceModal from './components/ConsequenceModal';
import Palette from './components/Palette';
import { proofExamples } from './examples';
import './App.css';

function App() {
  const [root, setRoot] = useState<TreeNode | null>(
  // Example initial tree with consequence rule applied
  //   {
  //   pre: { type: 'binop', op: '==', left: { type: 'var', name: 'x' }, right: { type: 'const', value: 0 } },
  //   stmt: { type: 'skip' },
  //   post: { type: 'true' },
  //   rule: 'consequence',
  //   children: [{
  //     pre: { type: 'true' } ,
  //     stmt: { type: 'skip' },
  //     post: { type: 'true' },
  //     children: []
  //   }]
  // }
);
  const [selectedExampleId, setSelectedExampleId] = useState(proofExamples[0]?.id ?? '');
  const [preExpr, setPreExpr] = useState<Expression | null>(null);
  const [builtStmt, setBuiltStmt] = useState<BuilderStatement | null>(null);
  const [postExpr, setPostExpr] = useState<Expression | null>(null);
  const [editingIntermediate, setEditingIntermediate] = useState(false);
  const [intermediateExpr, setIntermediateExpr] = useState<Expression | null>(null);
  const [editingConsequence, setEditingConsequence] = useState(false);
  const [newPreExpr, setNewPreExpr] = useState<Expression | null>(null);
  const [newPostExpr, setNewPostExpr] = useState<Expression | null>(null);
  const [currentPath, setCurrentPath] = useState<number[] | null>(null);

  const activeExample = proofExamples.find((example) => example.id === selectedExampleId) ?? null;

  const resetWorkspace = () => {
    setRoot(null);
    setPreExpr(null);
    setBuiltStmt(null);
    setPostExpr(null);
    setEditingIntermediate(false);
    setIntermediateExpr(null);
    setEditingConsequence(false);
    setNewPreExpr(null);
    setNewPostExpr(null);
    setCurrentPath(null);
  };

  const clearProofKeepProgram = () => {
    if (!root) {
      resetWorkspace();
      return;
    }

    // Clone once so builder edits are decoupled from the old proof tree objects.
    const preservedRoot = JSON.parse(JSON.stringify(root)) as TreeNode;

    setRoot(null);
    setPreExpr(preservedRoot.pre);
    setBuiltStmt(statementToBuilder(preservedRoot.stmt));
    setPostExpr(preservedRoot.post);
    setEditingIntermediate(false);
    setIntermediateExpr(null);
    setEditingConsequence(false);
    setNewPreExpr(null);
    setNewPostExpr(null);
    setCurrentPath(null);
  };

  const loadExample = () => {
    const example = proofExamples.find((entry) => entry.id === selectedExampleId);
    if (!example) {
      return;
    }

    resetWorkspace();
    setRoot(JSON.parse(JSON.stringify(example.root)) as TreeNode);
  };

  const createRoot = () => {
    const stmt = builderToStatement(builtStmt);
    if (!stmt || !preExpr || !postExpr) {
      alert('Incomplete statement or expressions');
      return;
    }
    setRoot({ pre: preExpr, stmt, post: postExpr, children: [] });
  };

  const setNodeByPath = (node: TreeNode, path: number[], newNode: TreeNode): TreeNode => {
    if (path.length === 0) return newNode;
    const [first, ...rest] = path;
    return {
      ...node,
      children: node.children.map((c, i) => i === first ? setNodeByPath(c, rest, newNode) : c)
    };
  };

  const getNodeByPath = (node: TreeNode, path: number[]): TreeNode | null => {
    let cur: TreeNode | null = node;
    for (const idx of path) {
      if (!cur || !cur.children || idx < 0 || idx >= cur.children.length) return null;
      cur = cur.children[idx];
    }
    return cur;
  };

  const getRuleApplicationError = (node: TreeNode, rule: string): string | null => {
    if (rule === 'skip') {
      if (node.stmt.type !== 'skip') {
        return 'Skip rule can only be applied to a skip statement.';
      }
      if (!exprEqual(node.pre, node.post)) {
        return `Skip rule requires identical pre and postconditions. Expected postcondition: {${exprToString(node.pre)}}.`;
      }
      return null;
    }

    if (rule === 'assign') {
      if (node.stmt.type !== 'assign') {
        return 'Assign rule can only be applied to an assignment statement of the form x := E.';
      }

      const expectedPre = exprSubstitute(node.post, node.stmt.var, node.stmt.expr);
      if (!exprEqual(node.pre, expectedPre)) {
        return `Assign rule requires precondition = postcondition with ${node.stmt.var} replaced by ${exprToString(node.stmt.expr)}. Expected precondition: {${exprToString(expectedPre)}}.`;
      }

      return null;
    }

    if (rule === 'sequence') {
      if (node.stmt.type !== 'sequence') {
        return 'Sequence rule can only be applied to a statement of the form S1; S2.';
      }
      return null;
    }

    if (rule === 'conditional') {
      if (node.stmt.type !== 'conditional') {
        return 'Conditional rule can only be applied to an if-then-else statement.';
      }
      return null;
    }

    if (rule === 'while') {
      if (node.stmt.type !== 'while') {
        return 'While rule can only be applied to a while statement.';
      }
      return null;
    }

    if (rule === 'consequence') {
      return null;
    }

    return `Unknown rule: ${rule}.`;
  };

  const applyRule = (pathOrNode: number[] | TreeNode, maybeRuleOrNode: any, maybeRule?: string): string | null => {
    // support two signatures:
    // 1) applyRule(path, rule)  -- new from TreeNodeComponent
    // 2) applyRule(node, rule)  -- legacy
    let path: number[] | undefined;
    let node: TreeNode | null = null;
    let rule: string;

    if (Array.isArray(pathOrNode)) {
      path = pathOrNode;
      if (typeof maybeRuleOrNode === 'string') {
        rule = maybeRuleOrNode;
        if (!root) return 'No proof tree available.';
        node = getNodeByPath(root, path);
        if (!node) return 'Could not find the selected node in the proof tree.';
      } else {
        // unexpected shape, try legacy
        node = maybeRuleOrNode;
        if (!maybeRule) return 'No rule was selected.';
        rule = maybeRule;
      }
    } else {
      node = pathOrNode;
      if (typeof maybeRuleOrNode !== 'string') return 'No rule was selected.';
      rule = maybeRuleOrNode;
    }

    if (!node) return 'Could not find the selected node in the proof tree.';

    const ruleError = getRuleApplicationError(node, rule);
    if (ruleError) return ruleError;

    const commit = (updatedNode?: TreeNode) => {
      if (!root) return;
      if (path && updatedNode) {
        const newRoot = path.length === 0
          ? { ...updatedNode }
          : setNodeByPath(root, path, updatedNode);
        setRoot(newRoot);
      } else {
        // shallow copy to trigger render
        setRoot({ ...root });
      }
    };

    if (rule === 'skip') {
      node.children = [];
      node.rule = 'skip';
      commit(node);
      return null;
    } else if (rule === 'assign') {
      node.children = [];
      node.rule = 'assign';
      commit(node);
      return null;
    } else if (rule === 'sequence') {
      // open modal
      console.log('applyRule: sequence at path', path);
      setEditingIntermediate(true);
      setIntermediateExpr(null);
      setCurrentPath(path || []);
      return null;
    } else if (rule === 'conditional') {
      const conditionalStmt = node.stmt;
      if (conditionalStmt.type !== 'conditional') {
        return 'Conditional rule can only be applied to an if-then-else statement.';
      }
      node.children = [
        { pre: { type: 'binop', op: '&&', left: node.pre, right: conditionalStmt.cond }, stmt: conditionalStmt.s1, post: node.post, children: [] },
        { pre: { type: 'binop', op: '&&', left: node.pre, right: { type: 'unop', op: '!', expr: conditionalStmt.cond } }, stmt: conditionalStmt.s2, post: node.post, children: [] }
      ];
      node.rule = 'conditional';
      commit(node);
      return null;
    } else if (rule === 'consequence') {
      setEditingConsequence(true);
      setNewPreExpr(null);
      setNewPostExpr(null);
      setCurrentPath(path || []);
      return null;
    } else if (rule === 'while') {
      const whileStmt = node.stmt;
      if (whileStmt.type !== 'while') {
        return 'While rule can only be applied to a while statement.';
      }
      node.children = [
        { pre: { type: 'binop', op: '&&', left: node.pre, right: whileStmt.cond }, stmt: whileStmt.body, post: node.pre, children: [] }
      ];
      node.rule = 'while';
      commit(node);
      return null;
    }

    return `Unknown rule: ${rule}.`;
  };

  const confirmIntermediate = () => {
    console.log('confirmIntermediate called, currentPath =', currentPath, 'intermediateExpr =', intermediateExpr, 'root =', root);
    if (!root) return;
    if (isComplete(intermediateExpr) && currentPath !== null) {
      const expr = intermediateExpr as Expression;

      setRoot(prev => {
        if (!prev) return prev;
        const nodeAtPath = getNodeByPath(prev, currentPath!);
        if (!nodeAtPath) return prev;
        if (nodeAtPath.stmt.type !== 'sequence') return prev;
        const seqStmt = nodeAtPath.stmt;
        const newNode = {
          ...nodeAtPath,
          children: [
            { pre: nodeAtPath.pre, stmt: seqStmt.s1, post: expr, children: [] },
            { pre: expr, stmt: seqStmt.s2, post: nodeAtPath.post, children: [] }
          ],
          rule: 'sequence'
        } as TreeNode;
        console.log('updated in setRoot =', newNode);
        return setNodeByPath(prev, currentPath!, newNode);
      });

      setEditingIntermediate(false);
      setIntermediateExpr(null);
      setCurrentPath(null);
    }
  };

  useEffect(() => {
    console.log('root changed:', root);
  }, [root]);

  const confirmConsequence = () => {
    if (!root) return;
    if (isComplete(newPreExpr) && isComplete(newPostExpr) && currentPath !== null) {
      const preExpr = newPreExpr as Expression;
      const postExpr = newPostExpr as Expression;

      setRoot(prev => {
        if (!prev) return prev;
        const nodeAtPath = getNodeByPath(prev, currentPath!);
        if (!nodeAtPath) return prev;
        const newNode: TreeNode = {
          ...nodeAtPath,
          children: [
            { pre: preExpr, stmt: nodeAtPath.stmt, post: postExpr, children: [] }
          ],
          rule: 'consequence',
          obligationsProved: false
        };
        return setNodeByPath(prev, currentPath!, newNode);
      });

      setEditingConsequence(false);
      setNewPreExpr(null);
      setNewPostExpr(null);
      setCurrentPath(null);
    }
  };

  const updateNode = (path: number[], updater: (node: TreeNode) => TreeNode) => {
    setRoot(prev => prev ? setNodeByPath(prev, path, updater(getNodeByPath(prev, path)!)) : prev);
  };

  const removeRule = (path: number[]) => {
    setRoot(prev => {
      if (!prev) return prev;
      const nodeAtPath = getNodeByPath(prev, path);
      if (!nodeAtPath) return prev;
      return setNodeByPath(prev, path, {
        ...nodeAtPath,
        children: [],
        rule: undefined,
        obligationsProved: undefined,
      });
    });
  };

  return (
    <div className="app-shell">
      <div className="examples container-bordered">
        <h2>Example Proofs</h2>
        {!root && <p className="example-description">Load a ready-made proof tree or build your own compactly from the palette.</p>}
        <div className="example-controls">
          <label htmlFor="example-proof-select">Example</label>
          <select
            id="example-proof-select"
            className="example-select"
            value={selectedExampleId}
            onChange={(event) => setSelectedExampleId(event.target.value)}
          >
            {proofExamples.map((example) => (
              <option key={example.id} value={example.id}>{example.title}</option>
            ))}
          </select>
          <button className="btn-primary" type="button" onClick={loadExample}>Load Example</button>
          <button className="btn-secondary" type="button" onClick={root ? clearProofKeepProgram : resetWorkspace}>{root ? 'Clear Proof' : 'Reset Builder'}</button>
        </div>
        {activeExample && <p className="example-description">{activeExample.description}</p>}
      </div>

      {/* Main application content: either the creation form (no root) or the tree view */}
      {!root ? (
        <div className="builder-layout">
          <div className="palette-column">
            <Palette type="statement" />
            <Palette type="expression" />
          </div>
          <div className="form container-bordered">
            <label>Precondition</label>
            <ExpressionBuilder expr={preExpr} onChange={setPreExpr} />
            <div className="stmt-builder-container">
              <label>Statement</label>
              <StatementBuilder stmt={builtStmt} onChange={setBuiltStmt} />
            </div>
            <label>Postcondition</label>
            <ExpressionBuilder expr={postExpr} onChange={setPostExpr} />
            <button className="btn-primary" type="button" onClick={createRoot}>Create Root</button>
          </div>
        </div>
      ) : (
        <div className="proof-layout">
          <p className={`proof-status ${isValidProof(root) ? 'valid' : 'invalid'}`}>Proof status: {isValidProof(root) ? 'Valid' : 'Incomplete/invalid'}</p>
          <TreeNodeComponent
            node={root}
            path={[]}
            onApplyRule={(path, node, rule) => applyRule(path, node, rule)}
            onRemoveRule={removeRule}
            onUpdateNode={updateNode}
          />
        </div>
      )}

      {/* Overlay modals: rendered on top of the main content so user can still see the page while editing */}
      {editingIntermediate && (
        <IntermediateModal
          intermediateExpr={intermediateExpr}
          setIntermediateExpr={setIntermediateExpr}
          onConfirm={confirmIntermediate}
          onCancel={() => { setEditingIntermediate(false); setIntermediateExpr(null); setCurrentPath(null); }}
        />
      )}

      {editingConsequence && (
        <ConsequenceModal
          newPreExpr={newPreExpr}
          setNewPreExpr={setNewPreExpr}
          newPostExpr={newPostExpr}
          setNewPostExpr={setNewPostExpr}
          onConfirm={confirmConsequence}
          onCancel={() => { setEditingConsequence(false); setNewPreExpr(null); setNewPostExpr(null); setCurrentPath(null); }}
        />
      )}
    </div>
  );
}

export default App;
