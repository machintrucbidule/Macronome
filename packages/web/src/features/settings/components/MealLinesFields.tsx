import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/Form/NumberInput';
import { useSettingsMutation, useSettingsQuery } from '../useSettings';
import styles from '../settings.module.css';

// Two configurable displayed-line floors (B-203): a desktop and a mobile minimum, both shown on
// every device, saved on the settings blob (`lines_desktop` / `lines_mobile`). Drafts are seeded
// from the query; a valid in-range value saves immediately (covers the ▲▼ stepper) and blur clamps
// then saves a final value (covers mid-typing out-of-range input). Bounds mirror the server Zod.
const LINES_MIN = 5;
const LINES_MAX = 50;
type LinesKey = 'lines_desktop' | 'lines_mobile';

export function MealLinesFields() {
  const { t } = useTranslation();
  const settings = useSettingsQuery().data?.data;
  const saveSettings = useSettingsMutation();
  const [desktop, setDesktop] = useState('');
  const [mobile, setMobile] = useState('');
  useEffect(() => {
    if (!settings) return;
    setDesktop(String(settings.lines_desktop));
    setMobile(String(settings.lines_mobile));
  }, [settings?.lines_desktop, settings?.lines_mobile]);

  const onChange = (key: LinesKey, raw: string, setDraft: (v: string) => void): void => {
    setDraft(raw);
    const n = Number(raw);
    if (
      Number.isInteger(n) &&
      n >= LINES_MIN &&
      n <= LINES_MAX &&
      settings &&
      n !== settings[key]
    ) {
      saveSettings.mutate({ [key]: n });
    }
  };
  const onBlur = (key: LinesKey, raw: string, setDraft: (v: string) => void): void => {
    if (!settings) return;
    const n = Math.round(Number(raw));
    const clamped = Number.isFinite(n)
      ? Math.min(LINES_MAX, Math.max(LINES_MIN, n))
      : settings[key];
    setDraft(String(clamped));
    if (clamped !== settings[key]) saveSettings.mutate({ [key]: clamped });
  };

  const field = (key: LinesKey, value: string, setDraft: (v: string) => void, note?: boolean) => (
    <div className={styles.row}>
      <span className={styles.lab}>
        {t(`settings.template.${key === 'lines_desktop' ? 'linesDesktop' : 'linesMobile'}`)}
        {note && <span className={styles.desc}>{t('settings.template.linesNote')}</span>}
      </span>
      <NumberInput
        value={value}
        min={LINES_MIN}
        max={LINES_MAX}
        step={1}
        wrapperClassName={styles.lines}
        aria-label={t(
          `settings.template.${key === 'lines_desktop' ? 'linesDesktop' : 'linesMobile'}`,
        )}
        onChange={(e) => onChange(key, e.target.value, setDraft)}
        onBlur={() => onBlur(key, value, setDraft)}
      />
    </div>
  );

  return (
    <>
      {field('lines_desktop', desktop, setDesktop, true)}
      {field('lines_mobile', mobile, setMobile)}
    </>
  );
}
