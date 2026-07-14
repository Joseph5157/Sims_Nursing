import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useInvites() {
  return useQuery({
    queryKey: ['invites'],
    queryFn: async () => {
      const res = await api.get('/invites');
      return res.data;
    },
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/invites', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useRegenerateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/invites/${id}/regenerate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
}
