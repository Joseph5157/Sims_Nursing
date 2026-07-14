import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useStudents(filters = {}) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: async () => {
      const res = await api.get('/students', { params: filters });
      return res.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useStudent(id) {
  return useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const res = await api.get(`/students/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useStudentSearch(q) {
  return useQuery({
    queryKey: ['studentSearch', q],
    queryFn: async () => {
      const res = await api.get('/students/search', { params: { q } });
      return res.data;
    },
    enabled: q?.length >= 2,
  });
}

export function useUploadStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, dryRun = false, deactivateMissing = false }) => {
      const form = new FormData();
      form.append('file', file);
      const params = new URLSearchParams();
      if (dryRun) params.append('dry_run', 'true');
      if (deactivateMissing) params.append('deactivate_missing', 'true');
      const qs = params.toString();
      return api.post(`/students/upload${qs ? '?' + qs : ''}`, form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useUploadLogs(filters = {}) {
  return useQuery({
    queryKey: ['uploadLogs', filters],
    queryFn: async () => {
      const res = await api.get('/students/upload-logs', { params: filters });
      return res.data;
    },
  });
}

export function usePromoteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/students/${id}/promote`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/students/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useBulkPromoteStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, ...data }) => api.patch('/students/bulk/promote', { ids, ...data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useBulkDeleteStudents() {
  const qc = useQueryClient();
  return useMutation({
    // axios DELETE sends a body via the `data` config key.
    mutationFn: (ids) => api.delete('/students/bulk', { data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}
