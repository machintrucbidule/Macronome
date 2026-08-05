import type { ReactNode } from 'react';
import { useSelectMenu } from './useSelectMenu';
import { SelectMenuPanel } from './SelectMenuPanel';
import styles from './SelectMenu.module.css';

// Generic clickable-badge + dropdown menu, styled like the OK/NOK/Auto verdict menu
// (design/components/badges-verdict.md + metric-cards.md §Verdict cluster). Mirrors the
// VerdictBadge open/close + outside-click + Escape pattern so a single control style is
// reused for any small inline single-select (e.g. the day activity level — B-085, or the
// rating dropdown — B-121). The per-option `className` is applied to both the matching menu
// item and the trigger, so the caller can colour-code options (the colour map lives with
// the caller, not here).
//
// `variant="field"` is the form presentation (forms-inputs.md §Select): Macronome ships no
// native <select>, so list fields (sex, rounding decimals, AI model, leftover container) use
// this component with the canonical text-field box, a placeholder and a disabled state.
// Open/close state lives in useSelectMenu, the panel in SelectMenuPanel.

export interface SelectMenuOption<T extends string> {
  value: T;
  // A plain string (e.g. the activity level) or rich content — e.g. the rating
  // dropdown renders coloured star glyphs per option (RatingSelect, B-121).
  label: ReactNode;
  className?: string;
}

interface SelectMenuProps<T extends string> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string | undefined;
  // Extra class on the dropdown panel — lets a caller override the default min-width
  // (e.g. the rating dropdown hugs its narrow star options — B-121).
  menuClassName?: string | undefined;
  variant?: 'badge' | 'field' | undefined;
  /** Rendered in --text-faint when `value` matches no option (field variant). */
  placeholder?: ReactNode;
  disabled?: boolean | undefined;
  /** Extra class on the trigger — e.g. a fixed field height. */
  triggerClassName?: string | undefined;
  /** Extra class on the positioning wrapper — the flex/grid item, so widths belong here. */
  wrapClassName?: string | undefined;
  'data-testid'?: string | undefined;
}

const cx = (...parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(' ');

interface ChromeArgs {
  isField: boolean;
  showPlaceholder: boolean;
  optionClassName?: string | undefined;
  triggerClassName?: string | undefined;
  wrapClassName?: string | undefined;
}

/** Wrapper + trigger classes. Kept out of the component so its own branching stays readable. */
const chrome = (a: ChromeArgs): { wrap: string; trigger: string } => ({
  wrap: cx(styles.wrap, a.isField && styles.wrapField, a.wrapClassName),
  trigger: cx(
    styles.trigger,
    a.isField && styles.field,
    a.showPlaceholder && styles.placeholder,
    a.optionClassName,
    a.triggerClassName,
  ),
});

export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  menuClassName,
  variant = 'badge',
  placeholder,
  disabled,
  triggerClassName,
  wrapClassName,
  'data-testid': testId,
}: SelectMenuProps<T>) {
  const m = useSelectMenu(options, value, onChange);
  const isField = variant === 'field';
  const showPlaceholder = !m.current && placeholder != null;
  const cls = chrome({
    isField,
    showPlaceholder,
    optionClassName: m.current?.className,
    triggerClassName,
    wrapClassName,
  });

  return (
    <div className={cls.wrap} ref={m.wrapRef} onKeyDown={m.onKeyDown}>
      <button
        type="button"
        ref={m.triggerRef}
        className={cls.trigger}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={m.open}
        aria-controls={m.controlsId}
        aria-activedescendant={m.activeDescendantId}
        disabled={disabled}
        data-testid={testId}
        onClick={m.toggle}
      >
        <span className={styles.cur}>
          {showPlaceholder ? placeholder : (m.current?.label ?? value)}
        </span>
        <span className={styles.caret}>▾</span>
      </button>
      {m.open && (
        <SelectMenuPanel
          listId={m.listId}
          options={options}
          value={value}
          active={m.active}
          isField={isField}
          dropUp={m.placement.dropUp}
          left={m.placement.left}
          maxHeight={m.placement.maxHeight}
          menuClassName={menuClassName}
          panelRef={m.menuRef}
          onChoose={m.choose}
        />
      )}
    </div>
  );
}
