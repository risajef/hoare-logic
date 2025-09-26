import { useState, useRef, useEffect } from 'react';
import type { Expression } from '../types';
import { isComplete } from '../utils';
import ExpressionBuilder from './ExpressionBuilder';
import Palette from './Palette';

interface ConsequenceModalProps {
  newPreExpr: Expression | null;
  setNewPreExpr: (expr: Expression | null) => void;
  newPostExpr: Expression | null;
  setNewPostExpr: (expr: Expression | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConsequenceModal({ newPreExpr, setNewPreExpr, newPostExpr, setNewPostExpr, onConfirm, onCancel }: ConsequenceModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const defaultLeft = Math.max(20, Math.round(w / 2 - 300));
    const defaultTop = Math.max(20, Math.round(h / 2 - 160));
    setPos({ left: defaultLeft, top: defaultTop });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    dragging.current = true;
    offset.current = {
      x: e.clientX - (rect ? rect.left : pos.left),
      y: e.clientY - (rect ? rect.top : pos.top)
    };
    (e.target as Element).setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({ left: e.clientX - offset.current.x, top: e.clientY - offset.current.y });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
    document.body.style.userSelect = '';
  };

  return (
    <div
      ref={containerRef}
      className="consequence-editor container-modal"
      style={{ left: pos.left, top: pos.top, transform: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'move' }} onPointerDown={onPointerDown}>
        <h3 style={{ margin: 0 }}>Build New Precondition P and Postcondition Q</h3>
        <button className="btn-small" onClick={onCancel}>✕</button>
      </div>
      <Palette type="expression" />
      <label>New Precondition:</label>
      <ExpressionBuilder expr={newPreExpr} onChange={setNewPreExpr} />
      <label>New Postcondition:</label>
      <ExpressionBuilder expr={newPostExpr} onChange={setNewPostExpr} />
      <div style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={onConfirm} disabled={!isComplete(newPreExpr) || !isComplete(newPostExpr)}>Confirm</button>
        <button className="btn-primary" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
    </div>
  );
}

export default ConsequenceModal;
