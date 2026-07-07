import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CtxItem } from './menu-types';
import { ContextMenuList } from './ContextMenuList';
import css from './context-menu.module.css';

// Cursor-anchored panel of the installed-window context menu (B-195): fixed-position at
// the click coordinates, clamped to the viewport; dismissed on Escape, outside mousedown,
// scroll, resize or item selection. Portaled to <body> so no ancestor overflow clips it.

export function ContextMenuPanel({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: CtxItem[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(4, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y, items]);

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    const onAway = (): void => onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onAway, true);
    window.addEventListener('resize', onAway);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onAway, true);
      window.removeEventListener('resize', onAway);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className={css.panel}
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      data-ctx-panel=""
    >
      <ContextMenuList items={items} onClose={onClose} />
    </div>,
    document.body,
  );
}
