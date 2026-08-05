import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DayDetail } from '@macronome/shared';
import { Banner } from '../../components/Banner/Banner';
import { SkeletonMealDay } from '../../components/states/SkeletonMealDay';
import { useIsMobile } from '../../lib/useIsMobile';
import { MealsProvider } from './MealsContext';
import { useMealsContextMenu } from './contextMenu/useMealsContextMenu';
import { useMealsController } from './hooks/useMealsController';
import { useUndoRedoKeys } from './hooks/useUndoRedoKeys';
import { useActiveMeal } from './hooks/useActiveMeal';
import { DayHeader } from './components/DayHeader/DayHeader';
import type { DayMenuActions } from './components/DayMenu/DayMenu';
import { MealsControls } from './components/MealsControls';
import { MealsOverlays } from './components/MealsOverlays';
import { MealScroller } from './components/MealScroller/MealScroller';
import { MealTabs } from './components/MealTabs';
import { DEFAULT_LINES_DESKTOP, DEFAULT_LINES_MOBILE } from './logic/lineRows';
import { DEFAULT_MIN_MEAL_COLUMNS } from './logic/columnFit';
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
  // Installed-window right-click menu on food lines / empty rows (B-195).
  useMealsContextMenu(ctl);
  const [clearing, setClearing] = useState(false);
  const [copying, setCopying] = useState(false);
  const isMobile = useIsMobile();
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
    <>
      <MealsProvider value={ctl}>
        {ctl.error && (
          <div className={styles.errorBar}>
            <Banner tone="warning" onDismiss={ctl.actions.dismissError}>
              {errorMessage}
            </Banner>
          </div>
        )}

        {ctl.isLoading || !ctl.day ? (
          // B-264: the placeholder carries the day's real shape — totals row + meal columns at
          // the module defaults (the user's own floors live in settings, which are still
          // loading here), so the screen does not reflow when the day lands. One column on a
          // phone, where the meal-tab layer shows a single meal at a time.
          <SkeletonMealDay
            columns={isMobile ? 1 : DEFAULT_MIN_MEAL_COLUMNS}
            lines={isMobile ? DEFAULT_LINES_MOBILE : DEFAULT_LINES_DESKTOP}
          />
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
    </>
  );
}
