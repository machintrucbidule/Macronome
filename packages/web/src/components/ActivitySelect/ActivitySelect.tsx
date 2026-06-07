import { useTranslation } from 'react-i18next';
import { ACTIVITY_LABEL_KEYS, ACTIVITY_LEVELS, type ActivityLevel } from '@macronome/shared';
import { SelectMenu, type SelectMenuOption } from '../SelectMenu/SelectMenu';
import styles from './ActivitySelect.module.css';

// Day activity-level picker (B-085): the verdict-style dropdown (SelectMenu) with the five
// levels colour-coded on a non-linear scale — Sédentaire red, a jump to Léger yellow, then a
// gradient up to Très intense green. The colour rides a leading dot (see the CSS map). Shared
// by the Repas verdict cluster and the Journal activity cell so both read identically.
const LEVEL_CLASS: Record<ActivityLevel, string | undefined> = {
  sedentary: styles.sedentary,
  lightly_active: styles.lightly,
  moderately_active: styles.moderate,
  very_active: styles.veryActive,
  extremely_active: styles.extreme,
};

interface ActivitySelectProps {
  value: ActivityLevel;
  onChange: (level: ActivityLevel) => void;
  ariaLabel?: string | undefined;
}

export function ActivitySelect({ value, onChange, ariaLabel }: ActivitySelectProps) {
  const { t } = useTranslation();
  const options: SelectMenuOption<ActivityLevel>[] = ACTIVITY_LEVELS.map((lvl) => ({
    value: lvl,
    label: t(ACTIVITY_LABEL_KEYS[lvl].label),
    className: `${styles.dot} ${LEVEL_CLASS[lvl]}`,
  }));

  return <SelectMenu value={value} options={options} onChange={onChange} ariaLabel={ariaLabel} />;
}
