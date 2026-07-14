import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useDutyTimingSettings() {
  return useQuery({
    queryKey: ['dutyTimingSettings'],
    queryFn: async () => {
      const res = await api.get('/duty-timing-settings');
      return res.data;
    },
  });
}

export function useUpdateDutyTimingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.patch('/duty-timing-settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dutyTimingSettings'] }),
  });
}
