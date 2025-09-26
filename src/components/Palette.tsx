interface PaletteProps {
  type: 'statement' | 'expression';
}

function Palette({ type }: PaletteProps) {
  if (type === 'statement') {
    return (
      <div className="palette container-bordered">
        <h3>Statement Blocks</h3>
        <div className="stmt-blocks">
          <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'skip')}>Skip</div>
          <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'assign')}>Assign</div>
          <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'sequence')}>Sequence</div>
          <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'conditional')}>Conditional</div>
          <div className="stmt-block" draggable onDragStart={(e) => e.dataTransfer.setData('stmtType', 'while')}>While</div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="palette container-bordered">
        <h3>Expression Blocks</h3>
        <div className="expr-blocks">
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'var')}>Variable</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'const')}>Constant</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'true')}>True</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'false')}>False</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'plus')}>+</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'minus')}>-</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'times')}>⨯</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'equals')}>=</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'less')}>&lt;</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'greater')}>&gt;</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'lessEqual')}>≤</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'greaterEqual')}>≥</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'and')}>∧</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'or')}>∨</div>
          <div className="expr-block" draggable onDragStart={(e) => e.dataTransfer.setData('exprType', 'not')}>¬</div>
        </div>
      </div>
    );
  }
}

export default Palette;
