import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { Banner } from '../../components/Banner/Banner';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { MealsProvider } from './MealsContext';
import { useMealsController } from './hooks/useMealsController';
import { DayHeader } from './components/DayHeader/DayHeader';
import { MealsControls } from './components/MealsControls';
import { MealsOverlays } from './components/MealsOverlays';
import { MealScroller } from './components/MealScroller/MealScroller';
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
  const [clearing, setClearing] = useState(false);

  return (
    <AppShell flush>
      <MealsProvider value={ctl}>
        {ctl.error && <Banner tone="warning">{t('meals.error', { code: ctl.error })}</Banner>}

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
                  onClear={() => setClearing(true)}
                  onAddMeal={(name) => void ctl.actions.addMeal(name, ctl.day?.meals.length ?? 0)}
                />
                <MealScroller meals={ctl.day.meals} />
              </>
            )}
          </>
        )}

        <MealsOverlays clearing={clearing} onCloseClear={() => setClearing(false)} />
      </MealsProvider>
    </AppShell>
  );
}
