import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/Form/NumberInput';
import { useNumberSetting } from '../useNumberSetting';
import styles from '../settings.module.css';

// Day-structure numeric steppers, all saved on the settings blob and sharing one edit rule
// (useNumberSetting): the two displayed-line floors (B-203 — `lines_desktop` / `lines_mobile`,
// both shown on every device) and the minimum meal-column count (B-244 — `min_meal_columns`,
// which only affects the desktop layout). Bounds mirror the server Zod.
const LINES_MIN = 5;
const LINES_MAX = 50;
const COLUMNS_MIN = 1;
const COLUMNS_MAX = 6;

export function MealLinesFields() {
  const { t } = useTranslation();
  const desktop = useNumberSetting('lines_desktop', LINES_MIN, LINES_MAX);
  const mobile = useNumberSetting('lines_mobile', LINES_MIN, LINES_MAX);
  const columns = useNumberSetting('min_meal_columns', COLUMNS_MIN, COLUMNS_MAX);

  const field = (labelKey: string, f: ReturnType<typeof useNumberSetting>, noteKey?: string) => (
    <div className={styles.row}>
      <span className={styles.lab}>
        {t(labelKey)}
        {noteKey && <span className={styles.desc}>{t(noteKey)}</span>}
      </span>
      <NumberInput
        value={f.value}
        min={f.min}
        max={f.max}
        step={1}
        wrapperClassName={styles.lines}
        aria-label={t(labelKey)}
        onChange={(e) => f.onChange(e.target.value)}
        onBlur={f.onBlur}
      />
    </div>
  );

  return (
    <>
      {field('settings.template.linesDesktop', desktop, 'settings.template.linesNote')}
      {field('settings.template.linesMobile', mobile)}
      {field('settings.template.minColumns', columns, 'settings.template.minColumnsNote')}
    </>
  );
}
