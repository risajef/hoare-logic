import { useState } from 'react';
import type { TreeNode, BuilderStatement } from './types';
import { stmtToString, isValidProof, builderToStatement } from './utils';
import './App.css';

function TreeNodeComponent({ node, onApplyRule }: { node: TreeNode; onApplyRule: (node: TreeNode, rule: string) => void }) {
  const isValid = isValidProof(node);
  return (
    <div className={`tree-node ${isValid ? '' : 'invalid-node'}`}>
      <p>{`{${node.pre}} ${stmtToString(node.stmt)} {${node.post}}`}</p>
      {node.rule && <p>Rule: {node.rule}</p>}
      {node.rule === 'consequence' && node.children.length === 1 && (
        <p>Obligations: {node.pre} ⊨ {node.children[0].pre} and {node.children[0].post} ⊨ {node.post}</p>
      )}
      <div className="rule-buttons">
        <button onClick={() => onApplyRule(node, 'skip')}>Skip</button>
        <button onClick={() => onApplyRule(node, 'assign')}>Assign</button>
        <button onClick={() => onApplyRule(node, 'sequence')}>Sequence</button>
        <button onClick={() => onApplyRule(node, 'conditional')}>Conditional</button>
        <button onClick={() => onApplyRule(node, 'consequence')}>Consequence</button>
        <button onClick={() => onApplyRule(node, 'while')}>While</button>
      </div>
      <div className="children">
        {node.children.map((child, i) => <TreeNodeComponent key={i} node={child} onApplyRule={onApplyRule} />)}
      </div>
    </div>
  );
}

function StatementBuilder({ stmt, onChange }: { stmt: BuilderStatement | null; onChange: (newStmt: BuilderStatement | null) => void }) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('stmtType');
    if (type === 'skip') {
      onChange({ type: 'skip' });
    } else if (type === 'assign') {
      const varName = prompt('Enter variable name');
      const expr = prompt('Enter expression');
      if (varName && expr) {
        onChange({ type: 'assign', var: varName, expr });
      }
    } else if (type === 'sequence') {
      onChange({ type: 'sequence', s1: null, s2: null });
    } else if (type === 'conditional') {
      const cond = prompt('Enter condition');
      if (cond) {
        onChange({ type: 'conditional', cond, s1: null, s2: null });
      }
    } else if (type === 'while') {
      const cond = prompt('Enter condition');
      if (cond) {
        onChange({ type: 'while', cond, body: null });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (!stmt) {
    return (
      <div className="stmt-drop-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
        Drop statement here
      </div>
    );
  }

  if (stmt.type === 'skip') {
    return (
      <div className="stmt-block built">
        skip
        <button onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }

  if (stmt.type === 'assign') {
    return (
      <div className="stmt-block built">
        {stmt.var} := {stmt.expr}
        <button onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }

  if (stmt.type === 'sequence') {
    return (
      <div className="stmt-block built">
        <StatementBuilder stmt={stmt.s1} onChange={(newS1) => onChange({ ...stmt, s1: newS1 })} />
        ;
        <StatementBuilder stmt={stmt.s2} onChange={(newS2) => onChange({ ...stmt, s2: newS2 })} />
        <button onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }

  if (stmt.type === 'conditional') {
    return (
      <div className="stmt-block built conditional">
        if {stmt.cond} then
        <StatementBuilder stmt={stmt.s1} onChange={(newS1) => onChange({ ...stmt, s1: newS1 })} />
        else
        <StatementBuilder stmt={stmt.s2} onChange={(newS2) => onChange({ ...stmt, s2: newS2 })} />
        <button onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }

  if (stmt.type === 'while') {
    return (
      <div className="stmt-block built while">
        while {stmt.cond} do
        <StatementBuilder stmt={stmt.body} onChange={(newBody) => onChange({ ...stmt, body: newBody })} />
        <button onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }

  return null;
}

function App() {
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [pre, setPre] = useState('');
  const [builtStmt, setBuiltStmt] = useState<BuilderStatement | null>(null);
  const [post, setPost] = useState('');

  const createRoot = () => {
    const stmt = builderToStatement(builtStmt);
    if (!stmt) {
      alert('Incomplete statement');
      return;
    }
    setRoot({ pre, stmt, post, children: [] });
  };

  const applyRule = (node: TreeNode, rule: string) => {
    if (rule === 'skip') {
      if (node.stmt.type !== 'skip') return;
      node.children = [];
      node.rule = 'skip';
    } else if (rule === 'assign') {
      if (node.stmt.type !== 'assign') return;
      node.children = [];
      node.rule = 'assign';
    } else if (rule === 'sequence') {
      if (node.stmt.type !== 'sequence') return;
      const intermediate = prompt('Enter intermediate condition R');
      if (!intermediate) return;
      node.children = [
        { pre: node.pre, stmt: node.stmt.s1, post: intermediate, children: [] },
        { pre: intermediate, stmt: node.stmt.s2, post: node.post, children: [] }
      ];
      node.rule = 'sequence';
    } else if (rule === 'conditional') {
      if (node.stmt.type !== 'conditional') return;
      node.children = [
        { pre: `${node.pre} ∧ ${node.stmt.cond}`, stmt: node.stmt.s1, post: node.post, children: [] },
        { pre: `${node.pre} ∧ ¬${node.stmt.cond}`, stmt: node.stmt.s2, post: node.post, children: [] }
      ];
      node.rule = 'conditional';
    } else if (rule === 'consequence') {
      // Prompt for new pre/post conditions
      const newPre = prompt('Enter strengthened precondition (P)');
      const newPost = prompt('Enter weakened postcondition (Q)');
      if (!newPre || !newPost) return;
      node.children = [
        { pre: newPre, stmt: node.stmt, post: newPost, children: [] }
      ];
      node.rule = 'consequence';
    } else if (rule === 'while') {
      if (node.stmt.type !== 'while') return;
      node.children = [
        { pre: `${node.pre} ∧ ${node.stmt.cond}`, stmt: node.stmt.body, post: node.pre, children: [] }
      ];
      node.rule = 'while';
    }
    setRoot({ ...root! });
  };

  // const handleStmtDrop = (e: React.DragEvent) => {
  //   e.preventDefault();
  //   const type = e.dataTransfer.getData('stmtType');
  //   if (type === 'skip') {
  //     setBuiltStmt({ type: 'skip' });
  //   } else if (type === 'assign') {
  //     const varName = prompt('Enter variable name');
  //     const expr = prompt('Enter expression');
  //     if (varName && expr) {
  //       setBuiltStmt({ type: 'assign', var: varName, expr });
  //     }
  //   } else if (type === 'sequence') {
  //     const s1 = prompt('Enter first statement');
  //     const s2 = prompt('Enter second statement');
  //     if (s1 && s2) {
  //       setBuiltStmt({ type: 'sequence', s1: parseStatement(s1)!, s2: parseStatement(s2)! });
  //     }
  //   } else if (type === 'conditional') {
  //     const cond = prompt('Enter condition');
  //     const s1 = prompt('Enter then statement');
  //     const s2 = prompt('Enter else statement');
  //     if (cond && s1 && s2) {
  //       setBuiltStmt({ type: 'conditional', cond, s1: parseStatement(s1)!, s2: parseStatement(s2)! });
  //     }
  //   } else if (type === 'while') {
  //     const cond = prompt('Enter condition');
  //     const body = prompt('Enter body statement');
  //     if (cond && body) {
  //       setBuiltStmt({ type: 'while', cond, body: parseStatement(body)! });
  //     }
  //   }
  // };

  return (
    <div>
      {!root ? (
        <div>
          <div className="palette">
            <h3>Statement Blocks</h3>
            <div className="stmt-blocks">
              <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'skip')}>Skip</div>
              <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'assign')}>Assign</div>
              <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'sequence')}>Sequence</div>
              <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'conditional')}>Conditional</div>
              <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'while')}>While</div>
            </div>
          </div>
          <div className="form">
            <input placeholder="Precondition" value={pre} onChange={e => setPre(e.target.value)} />
            <div className="stmt-builder-container">
              <label>Statement:</label>
              <StatementBuilder stmt={builtStmt} onChange={setBuiltStmt} />
            </div>
            <input placeholder="Postcondition" value={post} onChange={e => setPost(e.target.value)} />
            <button onClick={createRoot}>Create Root</button>
          </div>
        </div>
      ) : (
        <div>
          <TreeNodeComponent node={root} onApplyRule={applyRule} />
          <p className={isValidProof(root) ? 'valid' : 'invalid'}>Valid Proof: {isValidProof(root) ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
}

export default App;
