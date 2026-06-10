import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { Banner } from '../../components/Banner/Banner';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { MealsProvider } from './MealsContext';
import { useMealsController } from './hooks/useMealsController';
import { useUndoRedoKeys } from './hooks/useUndoRedoKeys';
import { useActiveMeal } from './hooks/useActiveMeal';
import { DayHeader } from './components/DayHeader/DayHeader';
import { MealsControls } from './components/MealsControls';
import { MealsOverlays } from './components/MealsOverlays';
import { MealScroller } from './components/MealScroller/MealScroller';
import { MealTabs } from './components/MealTabs';
import { todayIso } from './format';
import styles from './meals.module.css';

// Repas page (specifications/screens/meals.md): the core daily loop. Route container — fetches
// the day, lays out the sticky header + meal scroller, and wires the overlays (MealsOverlays).
// It renders server-computed figures; it never computes nutrition values.
export function MealsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ date?: string }>();
  const date = params.date ?? todayIso();
  const ctl = useMealsController(date);
  useUndoRedoKeys({ undo: ctl.undo, redo: ctl.redo });
  const [clearing, setClearing] = useState(false);
  const [copying, setCopying] = useState(false);
  // Mobile meal-tab layer (S4): which meal is shown ≤560px. Resets on day change; desktop
  // renders every column regardless (the tab bar is `display:none` ≥561px).
  const [activeMeal, setActiveMeal] = useActiveMeal(date, ctl.day?.meals.length ?? 0);

  // A copy from an empty yesterday is an expected no-op, shown as a plain info banner;
  // any other failure keeps the generic error message (B-082).
  const errorMessage =
    ctl.error === 'copy_source_empty'
      ? t('meals.copyEmpty')
      : t('meals.error', { code: ctl.error });

  return (
    <AppShell flush>
      <MealsProvider value={ctl}>
        {ctl.error && (
          <div className={styles.errorBar}>
            <Banner tone="warning" onDismiss={ctl.actions.dismissError}>
              {errorMessage}
            </Banner>
          </div>
        )}

        {ctl.isLoading || !ctl.day ? (
          <SkeletonRows />
        ) : (
          <>
            <DayHeader date={date} day={ctl.day} onNavigate={(d) => void navigate(`/day/${d}`)} />
            {ctl.day.kind === 'summary' ? (
              <p className={styles.partialHint}>{t('meals.partial.hint')}</p>
            ) : (
              <>
                <MealsControls
                  day={ctl.day}
                  date={date}
                  onClear={() => setClearing(true)}
                  onCopyYesterday={() => setCopying(true)}
                  onAddMeal={(name) => {
                    // The new meal is appended at the current end; activate its mobile tab too
                    // (spec §5.3 "+ Repas … activates its tab"). No-op on desktop.
                    const newIndex = ctl.day?.meals.length ?? 0;
                    void ctl.actions.addMeal(name, newIndex);
                    setActiveMeal(newIndex);
                  }}
                  undo={ctl.undo}
                  redo={ctl.redo}
                  canUndo={ctl.canUndo}
                  canRedo={ctl.canRedo}
                />
                <MealScroller meals={ctl.day.meals} activeIndex={activeMeal} />
                <MealTabs meals={ctl.day.meals} activeIndex={activeMeal} onSelect={setActiveMeal} />
              </>
            )}
          </>
        )}

        <MealsOverlays
          clearing={clearing}
          onCloseClear={() => setClearing(false)}
          copying={copying}
          onCloseCopy={() => setCopying(false)}
        />
      </MealsProvider>
    </AppShell>
  );
}
