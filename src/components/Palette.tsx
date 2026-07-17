interface PaletteProps {
  type: 'statement' | 'expression';
}

function setDragType(event: React.DragEvent, kind: 'stmt' | 'expr', value: string) {
  event.dataTransfer.setData(`${kind}Type`, value);
  event.dataTransfer.setData('text/plain', `${kind}:${value}`);
  event.dataTransfer.effectAllowed = 'copy';
}

function Palette({ type }: PaletteProps) {
  if (type === 'statement') {
    return (
      <div className="palette container-bordered">
        <h3>Statement Blocks</h3>
        <div className="stmt-blocks">
          <div className="stmt-block" draggable onDragStart={(e) => setDragType(e, 'stmt', 'skip')}>Skip</div>
          <div className="stmt-block" draggable onDragStart={(e) => setDragType(e, 'stmt', 'assign')}>Assign</div>
          <div className="stmt-block" draggable onDragStart={(e) => setDragType(e, 'stmt', 'sequence')}>Sequence</div>
          <div className="stmt-block" draggable onDragStart={(e) => setDragType(e, 'stmt', 'conditional')}>Conditional</div>
          <div className="stmt-block" draggable onDragStart={(e) => setDragType(e, 'stmt', 'while')}>While</div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="palette container-bordered">
        <h3>Expression Blocks</h3>
        <div className="expr-blocks">
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'var')}>Variable</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'const')}>Constant</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'true')}>True</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'false')}>False</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'plus')}>+</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'minus')}>-</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'times')}>⨯</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'equals')}>=</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'less')}>&lt;</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'greater')}>&gt;</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'lessEqual')}>≤</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'greaterEqual')}>≥</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'and')}>∧</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'or')}>∨</div>
          <div className="expr-block" draggable onDragStart={(e) => setDragType(e, 'expr', 'not')}>¬</div>
        </div>
      </div>
    );
  }
}

export default Palette;
