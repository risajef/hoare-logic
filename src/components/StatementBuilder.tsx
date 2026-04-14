import type { BuilderStatement } from '../types';
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
      const varName = window.prompt('Enter variable name')?.trim();
      if (varName) {
        onChange({ type: 'assign', var: varName, expr: null });
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

  const renderRemoveButton = () => (
    <button type="button" className="btn-remove" aria-label="Remove statement" onClick={() => onChange(null)}>×</button>
  );

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
        {renderRemoveButton()}
      </div>
    );
  }

  if (stmt.type === 'assign') {
    return (
      <div className="stmt-block built assign-stmt">
        <input className="assign-var-input" value={stmt.var} onChange={e => onChange({ ...stmt, var: e.target.value })} />
        <span className="assign-separator">:=</span>
        <div className="assign-expression-slot">
          <ExpressionBuilder expr={stmt.expr} onChange={(newExpr) => onChange({ ...stmt, expr: newExpr })} />
        </div>
        {renderRemoveButton()}
      </div>
    );
  }

  if (stmt.type === 'sequence') {
    return (
      <div className="stmt-block built">
        <StatementBuilder stmt={stmt.s1} onChange={(newS1) => onChange({ ...stmt, s1: newS1 })} />
        <span className="stmt-connector">;</span>
        <StatementBuilder stmt={stmt.s2} onChange={(newS2) => onChange({ ...stmt, s2: newS2 })} />
        {renderRemoveButton()}
      </div>
    );
  }

  if (stmt.type === 'conditional') {
    return (
      <div className="stmt-block built conditional">
        <div className="statement-row">
          <span className="stmt-keyword">if</span>
          <ExpressionBuilder expr={stmt.cond} onChange={(newCond) => onChange({ ...stmt, cond: newCond })} />
        </div>
        <div className="statement-row">
          <span className="stmt-keyword">then</span>
          <StatementBuilder stmt={stmt.s1} onChange={(newS1) => onChange({ ...stmt, s1: newS1 })} />
        </div>
        <div className="statement-row">
          <span className="stmt-keyword">else</span>
          <StatementBuilder stmt={stmt.s2} onChange={(newS2) => onChange({ ...stmt, s2: newS2 })} />
        </div>
        {renderRemoveButton()}
      </div>
    );
  }

  if (stmt.type === 'while') {
    return (
      <div className="stmt-block built while">
        <div className="statement-row">
          <span className="stmt-keyword">while</span>
          <ExpressionBuilder expr={stmt.cond} onChange={(newCond) => onChange({ ...stmt, cond: newCond })} />
        </div>
        <div className="statement-row">
          <span className="stmt-keyword">do</span>
          <StatementBuilder stmt={stmt.body} onChange={(newBody) => onChange({ ...stmt, body: newBody })} />
        </div>
        {renderRemoveButton()}
      </div>
    );
  }

  return null;
}

export default StatementBuilder;
