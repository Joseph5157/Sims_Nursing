import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { loadUserFromStorage, saveUserToStorage, clearUserStorage } from '../lib/auth';
import { clearAllCache } from '../lib/cache';

export function useCurrentUser() {
  const cachedUser = loadUserFromStorage();

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await api.get('/users/me');
      saveUserToStorage(res.data);
      return res.data;
    },
    initialData: cachedUser,
    // The cached snapshot is only for an instant paint on refresh (avoids a white
    // screen flash) — mark it as already stale so a background refetch of /users/me
    // still runs on mount instead of trusting a snapshot that may be from a different
    // tab/session and up to staleTime old.
    initialDataUpdatedAt: 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ identifier, password }) => api.post('/auth/login', { identifier, password }),
    onSuccess: (res) => {
      saveUserToStorage(res.data);
      qc.setQueryData(['currentUser'], res.data);
      // Drop the service-worker API cache so responses cached under a previous
      // user's session can never be served into this one on a flaky network.
      if ('caches' in window) {
        caches.delete('sims-api').catch(() => {});
      }
    },
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: ({ sims_id }) => api.post('/auth/otp/request', { sims_id }),
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sims_id, code }) => api.post('/auth/otp/verify', { sims_id, code }),
    // Mirror useLogin: the server has set the session cookies, but the client
    // must also seed the auth cache/storage — otherwise ProtectedRoute still
    // sees no user and bounces straight back to /login after a successful OTP.
    onSuccess: (res) => {
      saveUserToStorage(res.data);
      qc.setQueryData(['currentUser'], res.data);
      if ('caches' in window) {
        caches.delete('sims-api').catch(() => {});
      }
    },
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ current_password, new_password }) =>
      api.post('/auth/change-password', { current_password, new_password }),
    onSuccess: (res) => {
      saveUserToStorage(res.data);
      qc.setQueryData(['currentUser'], res.data);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      clearUserStorage();
      clearAllCache();
      qc.clear();
      if ('caches' in window) {
        caches.delete('sims-api').catch(() => {});
      }
      window.location.href = '/login';
    },
  });
}
