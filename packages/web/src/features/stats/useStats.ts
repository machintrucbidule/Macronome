import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../api/stats';

// Data hooks for the Stats screen. Rolling cards always reflect the latest logged day
// (independent of the year selector); adherence is scoped to the selected year. The server
// computes every figure — these hooks just fetch and cache.
const KEY = 'stats';

export function useRolling() {
  return useQuery({ queryKey: [KEY, 'rolling'], queryFn: () => statsApi.rolling() });
}

export function useAdherence(year: number) {
  return useQuery({ queryKey: [KEY, 'adherence', year], queryFn: () => statsApi.adherence(year) });
}
