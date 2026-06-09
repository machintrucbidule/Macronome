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
  const [copying, setCopying] = useState(false);

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
                  onAddMeal={(name) => void ctl.actions.addMeal(name, ctl.day?.meals.length ?? 0)}
                />
                <MealScroller meals={ctl.day.meals} />
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
