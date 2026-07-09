import { useTranslation } from 'react-i18next';
import {
  AI_MODEL_PRICES,
  AI_PRICE_MODELS,
  AI_PRICING_AS_OF,
  estimateTaskCostEur,
  type AiTaskKey,
} from '@macronome/shared';
import { formatFixed, formatInt } from '../../../lib/format/number';
import styles from '../settings.module.css';

// Indicative per-request cost under each prompt (B-211, design/components/ai-connection.md): a typical
// token estimate + the euro cost across the priced models (both Gemini tiers + Claude Haiku/Sonnet),
// shown for ALL tasks regardless of the selected model. It is an ESTIMATE — the real cost depends on
// the runtime payload (photo / food pool / the whole tracking dataset for advice) + the reply length.
export function AiCostEstimate({ taskKey }: { taskKey: AiTaskKey }) {
  const { t } = useTranslation();
  const est = estimateTaskCostEur(taskKey);
  return (
    <div className={styles.aiCost}>
      <span className={styles.aiCostHead}>
        {t('settings.ai.cost.label')} ·{' '}
        {t('settings.ai.cost.tokens', { tokens: formatInt(est.totalTokens) })} ·{' '}
        {t('settings.ai.cost.asOf', { date: AI_PRICING_AS_OF })}
      </span>
      <div className={styles.aiCostRows}>
        {AI_PRICE_MODELS.map((m) => (
          <span key={m} className={styles.aiCostRow}>
            <span className={styles.aiCostModel}>{AI_MODEL_PRICES[m].label}</span>
            <span className="num">{formatFixed(est.byModel[m], 3)} €</span>
          </span>
        ))}
      </div>
      <span className={styles.aiCostNote}>{t('settings.ai.cost.note')}</span>
    </div>
  );
}
