// Item/zone model for the installed-window context menu (B-195,
// design/components/context-menu.md). Pure types — no React.

export interface CtxItem {
  key: string;
  label: string;
  /** Destructive tone (Supprimer / Archiver). */
  danger?: boolean;
  /** Draw a divider above this item (used where a zone prefixes the generic block). */
  separator?: boolean;
  onSelect?: () => void;
  /** One submenu level only ("Déplacer vers ▸", "Aller à ▸"). */
  children?: CtxItem[];
}

export interface CtxZoneResult {
  items: CtxItem[];
  /** Append the generic block (Aller à / Actualiser) below, behind a separator. */
  appendGeneric?: boolean;
}

/** A screen's zone resolver: map the right-clicked element to its items, or null when the
 *  target is not one of the screen's rows (→ the generic menu). First non-null wins. */
export type CtxResolver = (target: HTMLElement) => CtxZoneResult | null;
