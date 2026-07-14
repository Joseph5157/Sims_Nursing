import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export function useMonthSlots(year, month) {
  return useQuery({
    queryKey: ['dutySlots', year, month],
    queryFn: async () => {
      const res = await api.get(`/duty-slots/${year}/${month}`);
      return res.data;
    },
    staleTime: 0,          // picks must reflect immediately after picking
    refetchInterval: 30_000, // P26: other faculty's picks show up without a manual refresh
    enabled: !!year && !!month,
  });
}

// All booked duty slots for the month across every faculty member (read-only) —
// powers the faculty "All Faculty Duties" reassignment-planning page.
export function useAllFacultyDuties(year, month) {
  return useQuery({
    queryKey: ['allFacultyDuties', year, month],
    queryFn: async () => {
      const res = await api.get(`/duty-slots/all/${year}/${month}`);
      return res.data;
    },
    refetchInterval: 30_000, // reflect other faculty's picks / reassignments without a manual refresh
    enabled: !!year && !!month,
  });
}

// Every duty slot ever assigned to the current faculty member — used to
// populate the duty-date filter on the Student Violations page.
export function useMyDutyDates() {
  return useQuery({
    queryKey: ['myDutyDates'],
    queryFn: async () => {
      const res = await api.get('/duty-slots/mine/dates');
      return res.data;
    },
  });
}

export function useAvailableSlots(year, month) {
  return useQuery({
    queryKey: ['availableSlots', year, month],
    queryFn: async () => {
      const res = await api.get(`/duty-slots/available/${year}/${month}`);
      return res.data;
    },
    staleTime: 0,          // always re-fetch — slot availability changes as others pick
    refetchInterval: 30_000, // P26: other faculty's picks show up without a manual refresh
    retry: false,          // 409 WINDOW_CLOSED is not a network error, don't retry
    enabled: !!year && !!month,
  });
}

export function usePickSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/duty-slots/pick', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availableSlots'] });
      qc.invalidateQueries({ queryKey: ['dutySlots'] });
    },
  });
}

export function useAdminAssignSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/duty-slots/admin-assign', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dutySlots'] }),
  });
}

// Admin-controlled duty reassignment. Moves an upcoming, un-attended duty to
// another faculty member and records the change in reassignment history.
export function useReassignSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to_faculty_id, reason }) =>
      api.post(`/duty-slots/${id}/reassign`, { to_faculty_id, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dutySlots'] }),
  });
}

// Faculty view of duties that were reassigned away from them for a month.
export function useReassignedAway(year, month) {
  return useQuery({
    queryKey: ['reassignedAway', year, month],
    queryFn: async () => {
      const res = await api.get(`/duty-slots/reassigned-away/${year}/${month}`);
      return res.data;
    },
    enabled: !!year && !!month,
  });
}
