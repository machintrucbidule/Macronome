import type { ReactNode } from 'react';
import { useCollapsed } from '../useCollapsed';
import styles from '../settings.module.css';

// Shared collapsible card shell for the Paramètres screen (B-209, specifications/screens/
// settings.md). The title row is a toggle (chevron ▾/▸, aria-expanded) that shows/hides the
// body; open/closed state persists per `id` in localStorage (useCollapsed). Mirrors the house
// AdviceArchive disclosure (glyph swap, conditional body — no animation). Renders; never computes.
interface SettingsCardProps {
  /** Stable id for the localStorage collapse map. */
  id: string;
  title: string;
  /** Open by default; pass false for the long/rarely-touched cards (template, Google Drive). */
  defaultOpen?: boolean;
  /** Optional right-side header content (version meta, connected pill). Non-interactive. */
  aside?: ReactNode;
  /** Adds `.flow` (overflow:visible) so a card's popovers can escape (garde-manger template). */
  flow?: boolean;
  /** Extra class on the body wrapper (e.g. the Google Drive card's `aiBody`). */
  bodyClassName?: string | undefined;
  children: ReactNode;
}

export function SettingsCard({
  id,
  title,
  defaultOpen = true,
  aside,
  flow,
  bodyClassName,
  children,
}: SettingsCardProps) {
  const [open, setOpen] = useCollapsed(id, defaultOpen);
  const bodyId = `settings-card-${id}`;
  const cardCls = flow ? `${styles.card} ${styles.flow}` : styles.card;
  const bodyCls = bodyClassName ? `${styles.cb} ${bodyClassName}` : styles.cb;

  return (
    <div className={cardCls}>
      <button
        type="button"
        className={styles.chToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.t}>{title}</span>
        <span className={styles.chRight}>
          {aside}
          <span className={styles.chevron} aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
        </span>
      </button>
      {open && (
        <div id={bodyId} className={bodyCls}>
          {children}
        </div>
      )}
    </div>
  );
}
