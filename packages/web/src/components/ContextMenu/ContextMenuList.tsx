import { useRef, useState } from 'react';
import type { CtxItem } from './menu-types';
import css from './context-menu.module.css';

// Items of the installed-window context menu (B-195): plain menuitems, a danger tone,
// and at most ONE submenu level, opened on hover/click and flipped left near the
// viewport's right edge.

function Item({ item, onClose }: { item: CtxItem; onClose: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`${css.item} ${item.danger ? css.danger : ''} ${item.separator ? css.sep : ''}`}
      onClick={() => {
        onClose();
        item.onSelect?.();
      }}
    >
      {item.label}
    </button>
  );
}

function SubItem({ item, onClose }: { item: CtxItem; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);

  const show = (): void => {
    const rect = wrapRef.current?.getBoundingClientRect();
    // Flip the submenu to the left when there is no room on the right (~200px panel).
    if (rect) setFlip(rect.right + 200 > window.innerWidth);
    setOpen(true);
  };

  return (
    <div
      ref={wrapRef}
      className={css.subWrap}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${css.item} ${item.separator ? css.sep : ''}`}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span>{item.label}</span>
        <span className={css.caret} aria-hidden="true">
          ▸
        </span>
      </button>
      {open && item.children && (
        <div className={`${css.submenu} ${flip ? css.subLeft : ''}`} role="menu">
          {item.children.map((c) => (
            <Item key={c.key} item={c} onClose={onClose} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContextMenuList({ items, onClose }: { items: CtxItem[]; onClose: () => void }) {
  return (
    <>
      {items.map((it) =>
        it.children ? (
          <SubItem key={it.key} item={it} onClose={onClose} />
        ) : (
          <Item key={it.key} item={it} onClose={onClose} />
        ),
      )}
    </>
  );
}
