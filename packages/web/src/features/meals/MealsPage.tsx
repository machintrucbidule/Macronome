import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { Banner } from '../../components/Banner/Banner';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { MealsProvider } from './MealsContext';
import { useMealsController } from './hooks/useMealsController';
import { useUndoRedoKeys } from './hooks/useUndoRedoKeys';
import { useActiveMeal } from './hooks/useActiveMeal';
import { DayHeader } from './components/DayHeader/DayHeader';
import type { DayMenuActions } from './components/DayMenu/DayMenu';
import { MealsControls } from './components/MealsControls';
import { MealsOverlays } from './components/MealsOverlays';
import { MealScroller } from './components/MealScroller/MealScroller';
import { MealTabs } from './components/MealTabs';
import { todayIso } from './format';
import styles from './meals.module.css';

// The detailed-day body: controls row (desktop) + meal scroller + mobile meal tabs. Extracted so
// the page container stays small; the day actions arrive as the shared `menu` bundle.
function DetailedMeals({
  day,
  date,
  menu,
  activeMeal,
  setActiveMeal,
}: {
  day: DayDetail;
  date: string;
  menu: DayMenuActions;
  activeMeal: number;
  setActiveMeal: (i: number) => void;
}) {
  return (
    <>
      <MealsControls
        day={day}
        date={date}
        onClear={menu.onClear}
        onCopyYesterday={menu.onCopyYesterday}
        onAddMeal={menu.onAddMeal}
        undo={menu.undo}
        redo={menu.redo}
        canUndo={menu.canUndo}
        canRedo={menu.canRedo}
      />
      <MealScroller meals={day.meals} activeIndex={activeMeal} onSwitchMeal={setActiveMeal} />
      <MealTabs meals={day.meals} activeIndex={activeMeal} onSelect={setActiveMeal} />
    </>
  );
}

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
  // a blocked cross-meal move (leftover group, B-187/B-188) gets its own explanation;
  // any other failure keeps the generic error message (B-082).
  const errorMessage =
    ctl.error === 'copy_source_empty'
      ? t('meals.copyEmpty')
      : ctl.error === 'entry_in_leftover_group'
        ? t('meals.moveInLeftover')
        : t('meals.error', { code: ctl.error });

  // Append the meal at the current end and activate its mobile tab (spec §5.3). No-op on desktop.
  const addMeal = (name: string): void => {
    const newIndex = ctl.day?.meals.length ?? 0;
    void ctl.actions.addMeal(name, newIndex);
    setActiveMeal(newIndex);
  };
  // Day actions for the mobile "⋯" menu (DayHeader, ≤560px, detailed days); same callbacks as the
  // desktop MealsControls row below.
  const dayMenu: DayMenuActions = {
    onAddMeal: addMeal,
    onCopyYesterday: () => setCopying(true),
    onClear: () => setClearing(true),
    undo: ctl.undo,
    redo: ctl.redo,
    canUndo: ctl.canUndo,
    canRedo: ctl.canRedo,
  };

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
            <DayHeader
              date={date}
              day={ctl.day}
              onNavigate={(d) => void navigate(`/day/${d}`)}
              menu={dayMenu}
            />
            {ctl.day.kind === 'summary' ? (
              <p className={styles.partialHint}>{t('meals.partial.hint')}</p>
            ) : (
              <DetailedMeals
                day={ctl.day}
                date={date}
                menu={dayMenu}
                activeMeal={activeMeal}
                setActiveMeal={setActiveMeal}
              />
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
