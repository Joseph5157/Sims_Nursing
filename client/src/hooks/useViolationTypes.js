import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useViolationTypes(all = false) {
  return useQuery({
    queryKey: ['violationTypes', all],
    queryFn: async () => {
      const res = await api.get('/violation-types', { params: all ? { all: 'true' } : {} });
      return res.data;
    },
  });
}

export function useCreateViolationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/violation-types', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violationTypes'] }),
  });
}

export function useUpdateViolationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/violation-types/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violationTypes'] }),
  });
}

export function useDeactivateViolationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/violation-types/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violationTypes'] }),
  });
}

export function useDeleteViolationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/violation-types/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violationTypes'] }),
  });
}
