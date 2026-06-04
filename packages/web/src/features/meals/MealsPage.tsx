import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CustomValues } from './hooks/useMealsController';
import { AppShell } from '../../app/AppShell';
import { Banner } from '../../components/Banner/Banner';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { MealsProvider } from './MealsContext';
import { useMealsController } from './hooks/useMealsController';
import { DayHeader } from './components/DayHeader/DayHeader';
import { MealScroller } from './components/MealScroller/MealScroller';
import { LeftoverModal } from './modals/LeftoverModal/LeftoverModal';
import { CustomFoodModal } from './modals/CustomFoodModal/CustomFoodModal';
import { todayIso } from './format';
import styles from './meals.module.css';

// Repas page (specifications/screens/meals.md): the core daily loop. Route container — fetches
// the day, lays out the sticky header + meal scroller, and wires the leftover / custom modals.
// It renders server-computed figures; it never computes nutrition values.
export function MealsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ date?: string }>();
  const date = params.date ?? todayIso();
  const ctl = useMealsController(date);

  const customInitial = useMemo<CustomValues | null>(() => {
    const target = ctl.customTarget;
    if (!target?.entryId || !ctl.day) return null;
    const entry = ctl.day.meals.flatMap((m) => m.entries).find((e) => e.id === target.entryId);
    if (!entry) return null;
    return {
      name: entry.custom_name ?? '',
      kcal: entry.snap.kcal,
      servedGrams: entry.served_grams,
      snap: entry.snap,
    };
  }, [ctl.customTarget, ctl.day]);

  const leftoverMeal = ctl.day?.meals.find((m) => m.id === ctl.leftoverMealId) ?? null;

  return (
    <AppShell>
      <MealsProvider value={ctl}>
        {ctl.error && <Banner tone="warning">{t('meals.error', { code: ctl.error })}</Banner>}

        {ctl.isLoading || !ctl.day ? (
          <SkeletonRows />
        ) : (
          <>
            <DayHeader
              date={date}
              day={ctl.day}
              onNavigate={(d) => {
                void navigate(`/day/${d}`);
              }}
            />
            <div className={styles.controls}>
              <span className={styles.hint}>{t('meals.hint')}</span>
              <button
                type="button"
                className={styles.addMeal}
                onClick={() => {
                  const name = window.prompt(t('meals.meal.addPrompt'));
                  if (name) void ctl.actions.addMeal(name, ctl.day?.meals.length ?? 0);
                }}
              >
                {t('meals.addMeal')}
              </button>
            </div>
            <MealScroller meals={ctl.day.meals} />
          </>
        )}

        {leftoverMeal && <LeftoverModal meal={leftoverMeal} />}
        {ctl.customTarget && <CustomFoodModal target={ctl.customTarget} initial={customInitial} />}
      </MealsProvider>
    </AppShell>
  );
}
