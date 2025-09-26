import type { BuilderStatement, Expression } from '../types';
import { parseExpression } from '../utils';
import ExpressionBuilder from './ExpressionBuilder';

interface StatementBuilderProps {
  stmt: BuilderStatement | null;
  onChange: (newStmt: BuilderStatement | null) => void;
}

function StatementBuilder({ stmt, onChange }: StatementBuilderProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('stmtType');
    if (type === 'skip') {
      onChange({ type: 'skip' });
    } else if (type === 'assign') {
      const varName = prompt('Enter variable name');
      const exprStr = prompt('Enter expression');
      if (varName && exprStr) {
        const expr = parseExpression(exprStr);
        if (expr) {
          onChange({ type: 'assign', var: varName, expr });
        }
      }
    } else if (type === 'sequence') {
      onChange({ type: 'sequence', s1: null, s2: null });
    } else if (type === 'conditional') {
      onChange({ type: 'conditional', cond: null, s1: null, s2: null });
    } else if (type === 'while') {
      onChange({ type: 'while', cond: null, body: null });
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
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  if (stmt.type === 'assign') {
    return (
      <div className="stmt-block built">
        <input value={stmt.var} onChange={e => onChange({ ...stmt, var: e.target.value })} /> :=
        {stmt.expr ? <ExpressionBuilder expr={stmt.expr} onChange={(newExpr) => onChange({ ...stmt, expr: newExpr })} /> : <span>Drop expression here</span>}
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
        if
        <ExpressionBuilder expr={stmt.cond} onChange={(newCond) => onChange({ ...stmt, cond: newCond })} />
        then
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
        while
        <ExpressionBuilder expr={stmt.cond} onChange={(newCond) => onChange({ ...stmt, cond: newCond })} />
        do
        <StatementBuilder stmt={stmt.body} onChange={(newBody) => onChange({ ...stmt, body: newBody })} />
        <button onClick={() => onChange(null)}>Remove</button>
      </div>
    );
  }

  return null;
}

export default StatementBuilder;
