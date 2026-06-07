import { useQuery } from '@tanstack/react-query';
import { aboutApi } from '../../api/about';

// Data hook for the À propos screen. The whole snapshot is server-derived; this just fetches it.
export function useAbout() {
  return useQuery({ queryKey: ['about'], queryFn: () => aboutApi.get() });
}
