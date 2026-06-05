import type { Container, CreateContainerRequest, UpdateContainerRequest } from '@macronome/shared';
import { api } from './client';

// Containers resource client (spec/api §Settings, screens/containers.md). CRUD over the
// tare catalog; the locked built-in "Rien" rejects edit/delete server-side.

export const containersApi = {
  list: () => api.get<{ data: Container[] }>('/containers'),
  create: (body: CreateContainerRequest) => api.post<{ data: Container }>('/containers', body),
  update: (id: string, body: UpdateContainerRequest) =>
    api.patch<{ data: Container }>(`/containers/${id}`, body),
  remove: (id: string) => api.del<void>(`/containers/${id}`),
};
