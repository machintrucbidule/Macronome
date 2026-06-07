import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodParseLabel, FoodParseWarning } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { ApiError } from '../../../api/client';
import { useParseLabel } from '../useFoods';
import styles from '../foods.module.css';

// Paste sub-dialog for the macro-label parser (PM-1/B-114, design/components/modals.md).
// The user pastes a grocery-site nutrition table; Parser calls POST /foods/parse-label.
// On success the parent fills the macro fields and closes; a structured parse error
// (reconstituted_label / no_reference / unparseable) shows inline and writes nothing.
const KNOWN_ERRORS = new Set(['reconstituted_label', 'no_reference', 'unparseable']);

interface ParseLabelDialogProps {
  onClose: () => void;
  onApplied: (macros: FoodParseLabel, warnings: FoodParseWarning[]) => void;
}

export function ParseLabelDialog({ onClose, onApplied }: ParseLabelDialogProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const parse = useParseLabel();

  const submit = (): void => {
    const label_text = text.trim();
    if (!label_text) return;
    setErrorCode(null);
    parse.mutate(
      { label_text },
      {
        onSuccess: (res) => onApplied(res.data, res.warnings ?? []),
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : 'unparseable';
          setErrorCode(KNOWN_ERRORS.has(code) ? code : 'unparseable');
        },
      },
    );
  };

  return (
    <Modal title={t('foods.parse.title')} size="confirm" onClose={onClose}>
      <div className={modalStyles.sub}>{t('foods.parse.sub')}</div>
      <div className={modalStyles.body}>
        <textarea
          className={styles.parsearea}
          value={text}
          autoFocus
          placeholder={t('foods.parse.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
        {errorCode && (
          <div className={styles.parseerror}>⚠ {t(`foods.parse.error.${errorCode}`)}</div>
        )}
      </div>

      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={parse.isPending || text.trim().length === 0}>
            {t('foods.parse.action')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
