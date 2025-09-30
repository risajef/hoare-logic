import { useState, useEffect } from 'react';
import type { TreeNode, BuilderStatement, Expression } from './types';
import { isValidProof, builderToStatement, isComplete } from './utils';
import TreeNodeComponent from './components/TreeNodeComponent';
import ExpressionBuilder from './components/ExpressionBuilder';
import StatementBuilder from './components/StatementBuilder';
import IntermediateModal from './components/IntermediateModal';
import ConsequenceModal from './components/ConsequenceModal';
import Palette from './components/Palette';
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
  const [preExpr, setPreExpr] = useState<Expression | null>(null);
  const [builtStmt, setBuiltStmt] = useState<BuilderStatement | null>(null);
  const [postExpr, setPostExpr] = useState<Expression | null>(null);
  const [editingIntermediate, setEditingIntermediate] = useState(false);
  const [intermediateExpr, setIntermediateExpr] = useState<Expression | null>(null);
  const [editingConsequence, setEditingConsequence] = useState(false);
  const [newPreExpr, setNewPreExpr] = useState<Expression | null>(null);
  const [newPostExpr, setNewPostExpr] = useState<Expression | null>(null);
  const [currentPath, setCurrentPath] = useState<number[] | null>(null);

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

  const applyRule = (pathOrNode: number[] | TreeNode, maybeRuleOrNode: any, maybeRule?: string) => {
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
        if (!root) return;
        node = getNodeByPath(root, path);
        if (!node) return;
      } else {
        // unexpected shape, try legacy
        node = maybeRuleOrNode;
        rule = maybeRule!;
      }
    } else {
      node = pathOrNode;
      rule = maybeRuleOrNode;
    }

    if (!node) return;

    const commit = (updatedNode?: TreeNode) => {
      if (!root) return;
      if (path && updatedNode) {
        const newRoot = setNodeByPath(root, path, updatedNode);
        setRoot(newRoot);
      } else {
        // shallow copy to trigger render
        setRoot({ ...root });
      }
    };

    if (rule === 'skip') {
      if (node.stmt.type !== 'skip') return;
      node.children = [];
      node.rule = 'skip';
      commit(node);
    } else if (rule === 'assign') {
      if (node.stmt.type !== 'assign') return;
      node.children = [];
      node.rule = 'assign';
      commit(node);
    } else if (rule === 'sequence') {
      if (node.stmt.type !== 'sequence') return;
      // open modal
      console.log('applyRule: sequence at path', path);
      setEditingIntermediate(true);
      setIntermediateExpr(null);
      setCurrentPath(path || []);
    } else if (rule === 'conditional') {
      if (node.stmt.type !== 'conditional') return;
      node.children = [
        { pre: { type: 'binop', op: '&&', left: node.pre, right: node.stmt.cond }, stmt: node.stmt.s1, post: node.post, children: [] },
        { pre: { type: 'binop', op: '&&', left: node.pre, right: { type: 'unop', op: '!', expr: node.stmt.cond } }, stmt: node.stmt.s2, post: node.post, children: [] }
      ];
      node.rule = 'conditional';
      commit(node);
    } else if (rule === 'consequence') {
      setEditingConsequence(true);
      setNewPreExpr(null);
      setNewPostExpr(null);
      setCurrentPath(path || []);
    } else if (rule === 'while') {
      if (node.stmt.type !== 'while') return;
      node.children = [
        { pre: { type: 'binop', op: '&&', left: node.pre, right: node.stmt.cond }, stmt: node.stmt.body, post: node.pre, children: [] }
      ];
      node.rule = 'while';
      commit(node);
    }
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

  return (
    <div>
      {/* Main application content: either the creation form (no root) or the tree view */}
      {!root ? (
        <div>
          <Palette type="statement" />
          <Palette type="expression" />
          <div className="form container-bordered">
            <label>Precondition:</label>
            <ExpressionBuilder expr={preExpr} onChange={setPreExpr} />
            <div className="stmt-builder-container">
              <label>Statement:</label>
              <StatementBuilder stmt={builtStmt} onChange={setBuiltStmt} />
            </div>
            <label>Postcondition:</label>
            <ExpressionBuilder expr={postExpr} onChange={setPostExpr} />
            <button className="btn-primary" onClick={createRoot}>Create Root</button>
          </div>
        </div>
      ) : (
        <div>
          <TreeNodeComponent node={root} path={[]} onApplyRule={(path, node, rule) => applyRule(path, node, rule)} onUpdateNode={updateNode} />
          <p className={isValidProof(root) ? 'valid' : 'invalid'}>Valid Proof: {isValidProof(root) ? 'Yes' : 'No'}</p>
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
