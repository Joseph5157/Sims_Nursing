import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useInbox(filters = {}) {
  return useQuery({
    queryKey: ['inbox', filters],
    queryFn: async () => {
      const res = await api.get('/messages/inbox', { params: filters });
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useSent(filters = {}) {
  return useQuery({
    queryKey: ['sent', filters],
    queryFn: async () => {
      const res = await api.get('/messages/sent', { params: filters });
      return res.data;
    },
  });
}

export function useMessage(id) {
  return useQuery({
    queryKey: ['message', id],
    queryFn: async () => {
      const res = await api.get(`/messages/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/messages', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['sent'] });
    },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/messages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['sent'] });
    },
  });
}
