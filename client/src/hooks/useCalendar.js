import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useCalendar(year, month) {
  return useQuery({
    queryKey: ['calendar', year, month],
    queryFn: async () => {
      const res = await api.get(`/calendar/${year}/${month}`);
      return res.data;
    },
    enabled: !!year && !!month,
  });
}

export function useOpenWindow(year, month) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/calendar/${year}/${month}/open`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', year, month] }),
  });
}

export function useCloseWindow(year, month) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/calendar/${year}/${month}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', year, month] }),
  });
}

export function useUpdateBlockedDates(year, month) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocked_dates) => api.patch(`/calendar/${year}/${month}/blocked-dates`, { blocked_dates }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', year, month] }),
  });
}

export function useUpdateSessionsPerFaculty(year, month) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessions_per_faculty) => api.patch(`/calendar/${year}/${month}/sessions-per-faculty`, { sessions_per_faculty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', year, month] }),
  });
}

export function useUnassignedFaculty(year, month) {
  return useQuery({
    queryKey: ['unassignedFaculty', year, month],
    queryFn: async () => {
      const res = await api.get(`/calendar/${year}/${month}/unassigned-faculty`);
      return res.data;
    },
    enabled: !!year && !!month,
  });
}

export function useAssignSlots(year, month) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facultyId, slots }) => api.post(`/calendar/${year}/${month}/assign/${facultyId}`, { slots }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unassignedFaculty', year, month] });
      qc.invalidateQueries({ queryKey: ['dutySlots'] });
    },
  });
}
