import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

function useAnalytics(path, params = {}) {
  return useQuery({
    queryKey: ['analytics', path, params],
    queryFn: async () => {
      const res = await api.get(`/analytics/${path}`, { params });
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export const useAnalyticsSummary        = (p) => useAnalytics('summary', p);
export const useAnalyticsTrend          = (p) => useAnalytics('trend', p);
export const useViolationTypeAnalysis   = (p) => useAnalytics('violation-types', p);
export const useRepeatViolators         = (p) => useAnalytics('repeat-violators', p);
export const useCourseAnalysis          = (p) => useAnalytics('course-analysis', p);
export const useYearAnalysis            = (p) => useAnalytics('year-analysis', p);
export const useFacultyAnalysis         = (p) => useAnalytics('faculty-analysis', p);
export const useViolationHeatmap        = (p) => useAnalytics('heatmap', p);

export const useAnalyticsFilterOptions = () => useQuery({
  queryKey: ['analytics', 'filter-options'],
  queryFn: async () => {
    const res = await api.get('/analytics/filter-options');
    return res.data;
  },
  staleTime: 5 * 60 * 1000,
});
