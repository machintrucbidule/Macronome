import { useTranslation } from 'react-i18next';
import { TextInput } from '../../../components/Form/TextInput';
import { NumberInput } from '../../../components/Form/NumberInput';
import styles from '../foods.module.css';

// Named-portions editor (0..n label+grams rows). These are the units the Daily log /
// Recipes offer for this food (specifications/screens/food-db.md).
export interface PortionDraft {
  label: string;
  grams: string;
}

interface NamedPortionsEditorProps {
  portions: PortionDraft[];
  onChange: (portions: PortionDraft[]) => void;
}

export function NamedPortionsEditor({ portions, onChange }: NamedPortionsEditorProps) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<PortionDraft>): void =>
    onChange(portions.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number): void => onChange(portions.filter((_, idx) => idx !== i));
  const add = (): void => onChange([...portions, { label: '', grams: '' }]);

  return (
    <div className={styles.portions}>
      <div className={styles.portionsHead}>
        <span>{t('foods.portions.head')}</span>
        <button type="button" className={styles.addPortion} onClick={add}>
          {t('foods.portions.add')}
        </button>
      </div>
      {portions.length === 0 ? (
        <div className={styles.portionsEmpty}>{t('foods.portions.empty')}</div>
      ) : (
        portions.map((p, i) => (
          <div className={styles.prow} key={i}>
            <TextInput
              value={p.label}
              placeholder={t('foods.portions.labelPlaceholder')}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <NumberInput
              value={p.grams}
              suffix="g"
              min={0}
              onChange={(e) => update(i, { grams: e.target.value })}
            />
            <button
              type="button"
              className={styles.rm}
              title={t('common.remove')}
              onClick={() => remove(i)}
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
}
