import { useRef, useState } from 'react';
import type { Expression } from '../types';

interface ExpressionBuilderProps {
  expr: Expression | null;
  onChange: (newExpr: Expression | null) => void;
}

function ExpressionBuilder({ expr, onChange }: ExpressionBuilderProps) {
  const [pendingValueType, setPendingValueType] = useState<'var' | 'const' | null>(null);
  const [pendingValue, setPendingValue] = useState('');
  const cancelledEditor = useRef(false);

  const startValueEditor = (type: 'var' | 'const', value: string) => {
    cancelledEditor.current = false;
    setPendingValueType(type);
    setPendingValue(value);
  };

  const cancelValueEditor = () => {
    cancelledEditor.current = true;
    setPendingValueType(null);
  };

  const commitPendingValue = () => {
    if (cancelledEditor.current) {
      cancelledEditor.current = false;
      return;
    }
    if (pendingValueType === 'var') {
      const name = pendingValue.trim();
      if (name) onChange({ type: 'var', name });
    } else if (pendingValueType === 'const') {
      const value = Number(pendingValue);
      if (!Number.isNaN(value)) onChange({ type: 'const', value });
    }
    setPendingValueType(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('exprType') || e.dataTransfer.getData('text/plain').replace(/^expr:/, '');
    if (type === 'var') {
      startValueEditor('var', 'x');
    } else if (type === 'const') {
      startValueEditor('const', '0');
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

  const renderValueEditor = (label: string) => (
    <input
      autoFocus
      className="expr-value-editor"
      aria-label={label}
      value={pendingValue}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setPendingValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commitPendingValue();
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelValueEditor();
        }
      }}
      onBlur={commitPendingValue}
    />
  );

  if (!expr) {
    if (pendingValueType) {
      return renderValueEditor(pendingValueType === 'var' ? 'variable name' : 'constant value');
    }

    return (
      <div
        className="expr-drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        Drop expression here
      </div>
    );
  }

  if (expr.type === 'var') {
    if (pendingValueType === 'var') return renderValueEditor('variable name');
    return (
      <div className="expr-block built" tabIndex={0} onClick={() => startValueEditor('var', expr.name)}>
        {expr.name}
        <button className="btn-remove" onClick={(event) => { event.stopPropagation(); onChange(null); }}>×</button>
      </div>
    );
  }

  if (expr.type === 'const') {
    if (pendingValueType === 'const') return renderValueEditor('constant value');
    return (
      <div className="expr-block built" tabIndex={0} onClick={() => startValueEditor('const', String(expr.value))}>
        {expr.value}
        <button className="btn-remove" onClick={(event) => { event.stopPropagation(); onChange(null); }}>×</button>
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
