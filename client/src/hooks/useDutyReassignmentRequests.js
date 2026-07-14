import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

// Faculty-to-faculty reassignment requests (Method 2, separate from the
// admin-controlled reassignment in useDutySlots.js).

export function useEligibleFaculty(dutySlotId) {
  return useQuery({
    queryKey: ['reassignmentRequests', 'eligibleFaculty', dutySlotId],
    queryFn: async () => {
      const res = await api.get(`/duty-reassignment-requests/eligible-faculty/${dutySlotId}`);
      return res.data;
    },
    enabled: !!dutySlotId,
  });
}

export function usePendingReassignmentRequests() {
  return useQuery({
    queryKey: ['reassignmentRequests', 'pending'],
    queryFn: async () => {
      const res = await api.get('/duty-reassignment-requests');
      return res.data;
    },
    refetchInterval: 30000,
  });
}

export function useSentReassignmentRequests() {
  return useQuery({
    queryKey: ['reassignmentRequests', 'sent'],
    queryFn: async () => {
      const res = await api.get('/duty-reassignment-requests/sent');
      return res.data;
    },
    refetchInterval: 30000,
  });
}

export function useCreateReassignmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/duty-reassignment-requests', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reassignmentRequests'] });
    },
  });
}

export function useRespondToReassignmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.patch(`/duty-reassignment-requests/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reassignmentRequests'] });
      qc.invalidateQueries({ queryKey: ['dutySlots'] });
      qc.invalidateQueries({ queryKey: ['reassignedAway'] });
    },
  });
}

export function useCancelReassignmentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/duty-reassignment-requests/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reassignmentRequests'] });
    },
  });
}
