import { useTranslation } from 'react-i18next';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { useSettingsQuery } from '../settings/useSettings';
import { AdviceDashboard } from './components/AdviceDashboard';
import { AdviceGenerate } from './components/AdviceGenerate';
import { AdviceArchive } from './components/AdviceArchive';
import { useAdviceList, useAdviceMutations } from './useAdvice';
import { notify } from '../../components/Toast/notify';
import styles from './advices.module.css';

// Advices page (specifications/screens/conseils.md, B-202): the aggregated-data dashboard (what the
// AI sees) + a "Générer des conseils IA" button + the archived advices (newest first, per-item
// delete). Everything is server-computed (rule 2); a freshly generated advice appears at the top of
// the archive after the list invalidates. Unconfigured advice → AiNotConfigured in AdviceGenerate.
export function AdvicesPage() {
  const { t } = useTranslation();
  const settings = useSettingsQuery().data?.data;
  // The advice endpoint needs a connection AND a model for this task (else 409). Gate the button on
  // the same condition; stay optimistic while settings are still loading (mirrors MealsControls).
  const ready = settings ? !!settings.ai && settings.ai.tasks.advice.model !== null : true;
  const list = useAdviceList();
  const { generate, remove } = useAdviceMutations();

  return (
    <>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('advices.title')}</h1>
        <p className={styles.lead}>{t('advices.intro')}</p>

        <AdviceGenerate
          ready={ready}
          pending={generate.isPending}
          error={generate.error}
          onGenerate={() => generate.mutate()}
        />

        <AdviceDashboard />

        <h2 className={styles.archiveTitle}>{t('advices.archiveTitle')}</h2>
        {list.isLoading ? (
          <SkeletonRows />
        ) : (
          <AdviceArchive
            advices={list.data?.data ?? []}
            onDelete={(id) =>
              // B-261: no undo — an archived AI output cannot be reproduced.
              remove.mutate(id, { onSuccess: () => notify('adviceDeleted') })
            }
            justGeneratedId={generate.data?.data.id ?? null}
          />
        )}
      </div>
    </>
  );
}
