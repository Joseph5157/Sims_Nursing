import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { getCacheKey, setCacheKey } from '../lib/cache';
import { saveUserToStorage } from '../lib/auth';

export function useUsers(filters = {}) {
  // Generate cache key based on filters
  const cacheKey = `USERS_${JSON.stringify(filters)}`;
  const cachedData = getCacheKey(cacheKey);

  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const res = await api.get('/users', { params: filters });
      // Cache the result
      setCacheKey(cacheKey, res.data);
      return res.data;
    },
    // getCacheKey returns null on a miss; passing null as initialData makes React
    // Query treat it as already-loaded fresh data and skip the fetch (staleTime),
    // leaving never-before-cached filter combos stuck empty. Coerce to undefined.
    initialData: cachedData ?? undefined,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useMessageRecipients() {
  return useQuery({
    queryKey: ['users', 'directory'],
    queryFn: async () => {
      const res = await api.get('/users/directory');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/reactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetUserLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/admin/users/${id}/reset-login`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// Self-service profile update (name/department/designation/title/avatar). Keeps the
// shared `currentUser` cache (and its sessionStorage mirror) in sync so the
// sidebar and any other consumer re-render with the new details immediately.
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/users/${id}/profile`, data),
    onSuccess: (res) => {
      saveUserToStorage(res.data);
      qc.setQueryData(['currentUser'], res.data);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useAuditLogs(filters = {}) {
  return useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: async () => {
      const res = await api.get('/admin/audit-logs', { params: filters });
      return res.data;
    },
  });
}
