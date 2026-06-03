import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { TargetForm } from './components/TargetForm';
import { EnginePanel } from './components/EnginePanel';
import { SuggestDialog } from './components/SuggestDialog';
import { draftToBody, initialTargetDraft, isSavable, type TargetDraft } from './draft';
import { useProfile, useTarget, useTargetMutations } from './useTargets';
import styles from './cibles.module.css';

// Cibles screen (specifications/screens/targets.md): manual targets on the left, the
// computed engine on the right. The boundary is the rule — targets are manual, the
// engine only informs. Derived tiles + warnings come from GET /target (rule 2: the web
// never computes); live-while-typing recompute is an M9 polish item.
export function CiblesPage() {
  const { t } = useTranslation();
  const target = useTarget();
  const profile = useProfile();
  const { save } = useTargetMutations();
  const [draft, setDraft] = useState<TargetDraft>(() => initialTargetDraft(null));
  const [suggesting, setSuggesting] = useState(false);

  // Seed the form from the persisted target when it loads / refreshes after a save.
  useEffect(() => {
    if (target.data) setDraft(initialTargetDraft(target.data.target));
  }, [target.data]);

  const set = (patch: Partial<TargetDraft>): void => setDraft((d) => ({ ...d, ...patch }));
  const ready = target.data && profile.data;

  return (
    <AppShell>
      <div className={styles.head}>
        <h1>{t('cibles.title')}</h1>
      </div>

      {!ready ? (
        <SkeletonRows />
      ) : (
        <div className={styles.layout}>
          <TargetForm
            draft={draft}
            set={set}
            onSave={() => save.mutate(draftToBody(draft))}
            onSuggest={() => setSuggesting(true)}
            canSave={isSavable(draft)}
            saving={save.isPending}
          />
          <EnginePanel
            engine={target.data.engine}
            warnings={target.data.warnings}
            profile={profile.data.data}
          />
        </div>
      )}

      {suggesting && (
        <SuggestDialog
          onClose={() => setSuggesting(false)}
          onApply={(min, max) => {
            set({ calorieMin: String(min), calorieMax: String(max) });
            setSuggesting(false);
          }}
        />
      )}
    </AppShell>
  );
}
