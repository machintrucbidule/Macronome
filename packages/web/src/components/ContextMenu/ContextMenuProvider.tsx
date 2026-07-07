import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../lib/useIsMobile';
import { useIsStandalone } from '../../lib/useIsStandalone';
import { ContextMenuContext, type ContextMenuRegistry } from './ContextMenuContext';
import { isNativeMenuTarget } from './gating';
import type { CtxItem, CtxResolver } from './menu-types';
import { ContextMenuPanel } from './ContextMenuPanel';

// Installed-window context menu (B-195, design/components/context-menu.md). One delegated
// document `contextmenu` listener, attached ONLY when the app runs standalone on the desktop
// layout — browser tabs and mobile keep the native menu everywhere. Text fields keep the
// native menu too (paste/spellcheck). Screens register zone resolvers (rows identified by
// data attributes); the first non-null resolver wins, anything else gets the generic menu
// (Aller à ▸ the six primary screens · Actualiser les données).

const NAV: ReadonlyArray<[string, string]> = [
  ['meals.title', '/'],
  ['journal.title', '/history'],
  ['weight.title', '/weight'],
  ['foods.title', '/foods'],
  ['recipes.title', '/recipes'],
  ['stats.title', '/stats'],
];

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const standalone = useIsStandalone();
  const isMobile = useIsMobile();
  const active = standalone && !isMobile;
  const resolvers = useRef<CtxResolver[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; items: CtxItem[] } | null>(null);

  const registry = useRef<ContextMenuRegistry>({
    register: (r) => {
      resolvers.current.push(r);
      return () => {
        resolvers.current = resolvers.current.filter((x) => x !== r);
      };
    },
  }).current;

  // Latest deps for the document listener without re-binding it per render.
  const buildRef = useRef<(target: HTMLElement) => CtxItem[]>(() => []);
  buildRef.current = (target) => {
    const generic: CtxItem[] = [
      {
        key: 'goto',
        label: t('contextMenu.goTo'),
        children: NAV.map(([k, path]) => ({
          key: path,
          label: t(k),
          onSelect: () => void navigate(path),
        })),
      },
      {
        key: 'refresh',
        label: t('contextMenu.refresh'),
        onSelect: () => void qc.invalidateQueries(),
      },
    ];
    for (const r of resolvers.current) {
      const res = r(target);
      if (!res) continue;
      if (!res.appendGeneric) return res.items;
      const first = generic[0] as CtxItem;
      return [...res.items, { ...first, separator: true }, ...generic.slice(1)];
    }
    return generic;
  };

  useEffect(() => {
    if (!active) return;
    const onContextMenu = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null;
      if (!target || isNativeMenuTarget(target)) return; // native menu in text fields
      e.preventDefault();
      // Right-click on the open panel keeps it (never rebuild from the panel's own DOM).
      if (target.closest('[data-ctx-panel]')) return;
      setMenu({ x: e.clientX, y: e.clientY, items: buildRef.current(target) });
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [active]);

  return (
    <ContextMenuContext.Provider value={registry}>
      {children}
      {menu && (
        <ContextMenuPanel x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </ContextMenuContext.Provider>
  );
}
