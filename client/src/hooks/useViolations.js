import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useViolations(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['violations', filters],
    queryFn: async () => {
      const res = await api.get('/violations', { params: filters });
      return res.data;
    },
    ...options,
  });
}

export function useMyViolations(filters = {}) {
  return useQuery({
    queryKey: ['myViolations', filters],
    queryFn: async () => {
      const res = await api.get('/violations/my', { params: filters });
      return res.data;
    },
  });
}

export function useCreateViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/violations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myViolations'] });
      qc.invalidateQueries({ queryKey: ['violations'] });
      qc.invalidateQueries({ queryKey: ['report'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Soft-deletes a violation (deleted_at) — invalidates broadly since a delete can
// shift counts across the violations list, dashboards, every report, and analytics.
export function useDeleteViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => api.delete(`/violations/${id}`, { data: reason ? { reason } : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['violations'] });
      qc.invalidateQueries({ queryKey: ['myViolations'] });
      qc.invalidateQueries({ queryKey: ['report'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useFlagViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, flag_note }) => api.patch(`/violations/${id}/flag`, { flag_note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myViolations'] });
      qc.invalidateQueries({ queryKey: ['report', 'flagged-violations'] });
    },
  });
}

export function useResolveFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => api.patch(`/violations/${id}/resolve-flag`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['violations'] });
      qc.invalidateQueries({ queryKey: ['report', 'flagged-violations'] });
    },
  });
}

