import type { Expression } from '../types';

interface ExpressionBuilderProps {
  expr: Expression | null;
  onChange: (newExpr: Expression | null) => void;
}

function ExpressionBuilder({ expr, onChange }: ExpressionBuilderProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('exprType');
    if (type === 'var') {
      const name = prompt('Enter variable name');
      if (name) onChange({ type: 'var', name });
    } else if (type === 'const') {
      const valueStr = prompt('Enter constant value');
      const value = parseFloat(valueStr || '');
      if (!isNaN(value)) onChange({ type: 'const', value });
    } else if (type === 'true') {
      onChange({ type: 'true' });
    } else if (type === 'false') {
      onChange({ type: 'false' });
    } else if (type === 'plus') {
      onChange({ type: 'binop', op: '+', left: null, right: null });
    } else if (type === 'minus') {
      onChange({ type: 'binop', op: '-', left: null, right: null });
    } else if (type === 'times') {
      onChange({ type: 'binop', op: '*', left: null, right: null });
    } else if (type === 'equals') {
      onChange({ type: 'binop', op: '==', left: null, right: null });
    } else if (type === 'less') {
      onChange({ type: 'binop', op: '<', left: null, right: null });
    } else if (type === 'greater') {
      onChange({ type: 'binop', op: '>', left: null, right: null });
    } else if (type === 'lessEqual') {
      onChange({ type: 'binop', op: '≤', left: null, right: null });
    } else if (type === 'greaterEqual') {
      onChange({ type: 'binop', op: '≥', left: null, right: null });
    } else if (type === 'and') {
      onChange({ type: 'binop', op: '∧', left: null, right: null });
    } else if (type === 'or') {
      onChange({ type: 'binop', op: '∨', left: null, right: null });
    } else if (type === 'not') {
      onChange({ type: 'unop', op: '¬', expr: null });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (!expr) {
    return (
      <div className="expr-drop-zone" onDrop={handleDrop} onDragOver={handleDragOver}>
        Drop expression here
      </div>
    );
  }

  if (expr.type === 'var') {
    return (
      <div className="expr-block built">
        {expr.name}
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  if (expr.type === 'const') {
    return (
      <div className="expr-block built">
        {expr.value}
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  if (expr.type === 'true') {
    return (
      <div className="expr-block built">
        true
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  if (expr.type === 'false') {
    return (
      <div className="expr-block built">
        false
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  if (expr.type === 'binop') {
    return (
      <div className="expr-block built">
        <ExpressionBuilder expr={expr.left} onChange={(newLeft) => onChange({ ...expr, left: newLeft })} />
        {expr.op}
        <ExpressionBuilder expr={expr.right} onChange={(newRight) => onChange({ ...expr, right: newRight })} />
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  if (expr.type === 'unop') {
    return (
      <div className="expr-block built">
        {expr.op}
        <ExpressionBuilder expr={expr.expr} onChange={(newExpr) => onChange({ ...expr, expr: newExpr })} />
        <button className="btn-remove" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  return null;
}

export default ExpressionBuilder;
