import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useLiveAttendance() {
  return useQuery({
    queryKey: ['liveAttendance'],
    queryFn: async () => {
      const res = await api.get('/attendance/live');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useMyAttendanceSummary(year, month) {
  return useQuery({
    queryKey: ['myAttendanceSummary', year, month],
    queryFn: async () => {
      const res = await api.get('/attendance/mine/summary', { params: { year, month } });
      return res.data;
    },
    enabled: !!year && !!month,
  });
}

export function useAttendance(dutySlotId) {
  return useQuery({
    queryKey: ['attendance', dutySlotId],
    queryFn: async () => {
      const res = await api.get(`/attendance/${dutySlotId}`);
      return res.data;
    },
    enabled: !!dutySlotId,
    retry: false, // 404 "no attendance record yet" is expected, not a transient failure
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dutySlotId) => api.post(`/attendance/${dutySlotId}/check-in`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liveAttendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['dutySlots'] });
      qc.invalidateQueries({ queryKey: ['myAttendanceSummary'] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dutySlotId) => api.post(`/attendance/${dutySlotId}/check-out`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liveAttendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['dutySlots'] });
      qc.invalidateQueries({ queryKey: ['myAttendanceSummary'] });
    },
  });
}

export function useOverrideAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dutySlotId, ...data }) => api.patch(`/attendance/${dutySlotId}/override`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liveAttendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
