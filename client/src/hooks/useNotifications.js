import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/messages/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', 'inbox'] });
    },
  });
}
