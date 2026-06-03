import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// Proves the full round-trip browser → proxy → api → db by reading /health.
interface Health {
  status: string;
  db: string;
}

export function HealthStatus() {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health') });

  if (query.isLoading) return <p>{t('health.checking')}</p>;
  if (query.isError || query.data?.status !== 'ok') {
    return <p role="alert">{t('health.error')}</p>;
  }
  return <p data-testid="health-ok">{t('health.ok')}</p>;
}
