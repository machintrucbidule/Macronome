import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { TargetForm } from './components/TargetForm';
import { EnginePanel } from './components/EnginePanel';
import { SuggestDialog } from './components/SuggestDialog';
import { TargetHistory } from './components/TargetHistory';
import { RecomputeConfirm } from './components/RecomputeConfirm';
import { DeleteTargetConfirm } from './components/DeleteTargetConfirm';
import { isSavable } from './draft';
import { useTargetsController, type CiblesController } from './useTargetsController';
import styles from './targets.module.css';

// Cibles screen (specifications/screens/targets.md + TH-1): manual targets on the left,
// the computed engine on the right, the version history below. The form doubles as the
// history editor — create mode POSTs a new version, loading a row PATCHes it, and a past
// version offers the opt-in recompute. All derived figures come from the server (rule 2);
// the controller hook owns the UI state so this stays a thin renderer.
export function TargetsPage() {
  const { t } = useTranslation();
  const c = useTargetsController();
  const { live, ready } = c;

  return (
    <AppShell>
      <div className={styles.head}>
        <h1>{t('targets.title')}</h1>
      </div>

      {!ready || !live ? (
        <SkeletonRows />
      ) : (
        <>
          <div className={styles.layout}>
            <TargetForm
              draft={c.draft}
              set={c.set}
              engine={live.engine}
              editing={c.editing}
              onSave={c.onSave}
              onSuggest={() => c.setSuggesting(true)}
              onNewTarget={c.onNewTarget}
              onBackToCurrent={c.onBackToCurrent}
              onDelete={c.onDelete}
              onRecompute={c.onRecompute}
              recomputeCount={c.recomputeCount}
              canSave={isSavable(c.draft)}
              saving={c.saving}
            />
            <EnginePanel engine={live.engine} warnings={live.warnings} />
          </div>

          {c.mutError && (
            <p className={styles.formError}>
              {t(`targets.error.${c.mutError}`, { defaultValue: c.mutError })}
            </p>
          )}

          <TargetHistory
            versions={c.versions}
            activeId={c.editing?.id ?? null}
            onSelect={c.onSelect}
            onDelete={(v) => c.setConfirmDelete(v)}
          />
          <CiblesModals c={c} />
        </>
      )}
    </AppShell>
  );
}

/** The three Cibles dialogs (suggest, recompute confirm, delete confirm). */
function CiblesModals({ c }: { c: CiblesController }) {
  return (
    <>
      {c.suggesting && (
        <SuggestDialog onClose={() => c.setSuggesting(false)} onApply={c.onApplySuggest} />
      )}
      {c.confirmRecompute && c.editing && (
        <RecomputeConfirm
          count={c.recomputeCount ?? 0}
          periodLabel={c.periodLabel}
          pending={c.recomputePending}
          onCancel={() => c.setConfirmRecompute(false)}
          onConfirm={c.doRecompute}
        />
      )}
      {c.confirmDelete && (
        <DeleteTargetConfirm
          version={c.confirmDelete}
          pending={c.removePending}
          onCancel={() => c.setConfirmDelete(null)}
          onConfirm={c.doDelete}
        />
      )}
    </>
  );
}
