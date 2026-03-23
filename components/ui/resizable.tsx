'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastPos = useRef(0);
  const handleRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [direction]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const current = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = current - lastPos.current;
    if (delta !== 0) {
      onResize(delta);
      lastPos.current = current;
    }
  }, [direction, onResize]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const isH = direction === 'horizontal';

  return (
    <div
      ref={handleRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="flex-shrink-0 group relative"
      style={{
        width: isH ? 6 : '100%',
        height: isH ? '100%' : 6,
        cursor: isH ? 'col-resize' : 'row-resize',
        touchAction: 'none',
        zIndex: 10,
      }}
    >
      {/* Visible line */}
      <div
        className="absolute transition-colors duration-150"
        style={{
          ...(isH
            ? { top: 0, bottom: 0, left: 2, width: 2 }
            : { left: 0, right: 0, top: 2, height: 2 }),
          background: '#1e2d45',
          borderRadius: 1,
        }}
      />
      {/* Hover highlight */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{
          ...(isH
            ? { top: 0, bottom: 0, left: 1, width: 4 }
            : { left: 0, right: 0, top: 1, height: 4 }),
          background: '#3b82f680',
          borderRadius: 2,
        }}
      />
      {/* Drag dots indicator */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          ...(isH
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', gap: 3 }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'row', gap: 3 }),
        }}
      >
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#3b82f6' }} />
        ))}
      </div>
    </div>
  );
}

// ── Horizontal split (left | right) ──

interface HorizontalSplitProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number; // px
  minLeft?: number;
  maxLeft?: number;
  className?: string;
  style?: CSSProperties;
}

export function HorizontalSplit({
  left, right,
  defaultLeftWidth = 280,
  minLeft = 180,
  maxLeft = 500,
  className = '',
  style,
}: HorizontalSplitProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);

  const handleResize = useCallback((delta: number) => {
    setLeftWidth(w => Math.max(minLeft, Math.min(maxLeft, w + delta)));
  }, [minLeft, maxLeft]);

  return (
    <div className={`flex ${className}`} style={style}>
      <div className="flex-shrink-0 min-h-0 overflow-hidden" style={{ width: leftWidth }}>
        {left}
      </div>
      <ResizeHandle direction="horizontal" onResize={handleResize} />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
}

// ── Vertical split (top / bottom) ──

interface VerticalSplitProps {
  top: ReactNode;
  bottom: ReactNode;
  defaultBottomHeight?: number; // px
  minBottom?: number;
  maxBottom?: number;
  className?: string;
  style?: CSSProperties;
}

export function VerticalSplit({
  top, bottom,
  defaultBottomHeight = 160,
  minBottom = 80,
  maxBottom = 400,
  className = '',
  style,
}: VerticalSplitProps) {
  const [bottomHeight, setBottomHeight] = useState(defaultBottomHeight);

  const handleResize = useCallback((delta: number) => {
    // dragging down = positive delta = bottom gets smaller
    setBottomHeight(h => Math.max(minBottom, Math.min(maxBottom, h - delta)));
  }, [minBottom, maxBottom]);

  return (
    <div className={`flex flex-col ${className}`} style={style}>
      <div className="flex-1 min-h-0 overflow-hidden">
        {top}
      </div>
      <ResizeHandle direction="vertical" onResize={handleResize} />
      <div className="flex-shrink-0 overflow-hidden" style={{ height: bottomHeight }}>
        {bottom}
      </div>
    </div>
  );
}
