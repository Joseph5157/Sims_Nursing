import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorRow, ErrorBlock } from '../../components/ui/Table';
import { Button, Select } from '@mantine/core';
import { LineChart, BarChart } from '@mantine/charts';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import RecordViolationModal from '../../components/faculty/RecordViolationModal';
import { useToast } from '../../components/ui/Toast';
import { useViolations, useDeleteViolation } from '../../hooks/useViolations';
import { ROUTES } from '../../utils/constants';
import { useUsers } from '../../hooks/useUsers';
import {
  useAnalyticsSummary,
  useAnalyticsTrend,
  useViolationTypeAnalysis,
  useRepeatViolators,
  useCourseAnalysis,
  useYearAnalysis,
  useFacultyAnalysis,
  useViolationHeatmap,
  useAnalyticsFilterOptions,
} from '../../hooks/useAnalytics';
import api from '../../utils/api';
import Breadcrumb from '../../components/Breadcrumb';

const COURSE_LABELS = { b_pharm: 'B.Pharm', pharm_d: 'Pharm.D', m_pharm: 'M.Pharm' };
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A violation's recorder is a faculty member on duty OR an admin who recorded it
// directly. Admin recorders surface as "Admin"; faculty as their name.
function recorderName(faculty) {
  if (!faculty) return '—';
  return faculty.role === 'admin' || faculty.role === 'super_admin' ? 'Admin' : faculty.name;
}

const selectCls = 'border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)] bg-[var(--surface-card)] text-[var(--text-secondary)] text-[length:13px]';

const RANGE_OPTIONS = [
  { value: 'this_week',  label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom',     label: 'Custom Range' },
];

// Tiered green→red fill for a heatmap cell, keyed on count / max ratio.
// Green = quiet day, red = high-violation day (per the P24 spec).
function heatColor(count, max) {
  if (!count) return { bg: 'var(--surface-page)', fg: 'var(--text-muted)' };
  const r = count / max;
  const bg = r <= 0.25 ? '#34d399' : r <= 0.5 ? '#fbbf24' : r <= 0.75 ? '#fb923c' : '#ef4444';
  return { bg, fg: '#0f172a' };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// GitHub-contribution-style calendar heatmap spanning the days present in the
// data (padded to whole Mon–Sun weeks). Needs no charting library.
function ViolationHeatmap({ data, max }) {
  if (!data?.length) {
    return <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No violations in this period.</p>;
  }

  const countByDate = new Map(data.map((d) => [d.date, d.count]));
  const parse = (s) => new Date(`${s}T12:00:00`);
  const sorted = data.map((d) => d.date).sort();
  const min = parse(sorted[0]);
  const maxD = parse(sorted[sorted.length - 1]);

  // Pad start back to Monday, end forward to Sunday.
  const start = new Date(min);
  const startDow = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - startDow);
  const end = new Date(maxD);
  const endDow = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - endDow));

  const cells = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    cells.push({ iso, day: d.getDate(), count: countByDate.get(iso) ?? 0 });
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(28px, 1fr))', minWidth: 220 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[length:10px] font-medium text-[var(--text-muted)] text-center pb-0.5">{w}</div>
        ))}
        {cells.map((c) => {
          const { bg, fg } = heatColor(c.count, max || 1);
          return (
            <div
              key={c.iso}
              title={`${c.iso}: ${c.count} violation${c.count === 1 ? '' : 's'}`}
              className="aspect-square rounded flex items-center justify-center text-[length:10px] font-semibold border border-[var(--border)]"
              style={{ backgroundColor: bg, color: fg }}
            >
              {c.day}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[length:11px] text-[var(--text-muted)]">
        <span>Fewer</span>
        <div className="flex gap-1">
          {['var(--surface-page)', '#34d399', '#fbbf24', '#fb923c', '#ef4444'].map((c) => (
            <div key={c} className="w-3.5 h-3.5 rounded border border-[var(--border)]" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function DisciplineAnalytics() {
  const [range, setRange]           = useState('this_month');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [course, setCourse]         = useState('');
  const [year, setYear]             = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [violationTypeId, setViolationTypeId] = useState('');

  const params = useMemo(() => ({
    range,
    ...(range === 'custom' && fromDate && toDate ? { from_date: fromDate, to_date: toDate } : {}),
    ...(course ? { course } : {}),
    ...(year ? { year } : {}),
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(violationTypeId ? { violation_type_id: violationTypeId } : {}),
  }), [range, fromDate, toDate, course, year, academicYear, violationTypeId]);

  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const { data: filterOptions }  = useAnalyticsFilterOptions();
  const { data: summary }        = useAnalyticsSummary(params);
  const { data: trendData }      = useAnalyticsTrend(params);
  const { data: typeAnalysis }   = useViolationTypeAnalysis(params);
  const { data: repeatData }     = useRepeatViolators(params);
  const { data: courseData }     = useCourseAnalysis(params);
  const { data: yearData }       = useYearAnalysis(params);
  const { data: facultyData }    = useFacultyAnalysis(params);
  const { data: heatmapData }    = useViolationHeatmap(params);

  const maxTypeCount = Math.max(1, ...(typeAnalysis?.data?.map((t) => t.count) ?? [0]));
  const maxFacultyCount = Math.max(1, ...(facultyData?.data?.map((f) => f.count) ?? [0]));

  const trendChartData = (trendData?.data ?? []).map((t) => ({
    label: `${MONTH_LABELS[t.month - 1]} ${String(t.year).slice(2)}`,
    count: t.count,
  }));
  const courseChartData = (courseData?.data ?? []).map((c) => ({ course: COURSE_LABELS[c.course] ?? c.course, count: c.count }));
  const yearChartData   = (yearData?.data ?? []).map((y) => ({ year: `Year ${y.year}`, count: y.count }));

  async function handleExportCounselling() {
    setExporting(true);
    try {
      const res = await api.get('/analytics/export/counselling', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'counselling-list.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: 'Could not export the counselling list.', type: 'error' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mb-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Violations"  value={summary?.total_violations ?? 0}  sub="Selected period" accent="blue" />
        <StatCard label="Students Affected" value={summary?.students_affected ?? 0} sub="Unique students" accent="indigo" />
        <StatCard label="Repeat Violators"  value={summary?.repeat_violators_count ?? 0} sub="Need counselling" accent="red" />
        <StatCard
          label="Most Common"
          value={summary?.most_common?.type ?? '—'}
          sub={summary?.most_common ? `${summary.most_common.count} cases` : 'No data'}
          accent="yellow"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={range} onChange={(e) => setRange(e.target.value)} className={selectCls}>
          {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {range === 'custom' && (
          <>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={selectCls} />
            <input type="date" value={toDate}   onChange={(e) => setToDate(e.target.value)}   className={selectCls} />
          </>
        )}
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={selectCls}>
          <option value="">All Courses</option>
          {filterOptions?.courses?.map((c) => <option key={c} value={c}>{COURSE_LABELS[c] ?? c}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>
          <option value="">All Years</option>
          {filterOptions?.years?.map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={selectCls}>
          <option value="">All Academic Years</option>
          {filterOptions?.academic_years?.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={violationTypeId} onChange={(e) => setViolationTypeId(e.target.value)} className={selectCls}>
          <option value="">All Violation Types</option>
          {filterOptions?.violation_types?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Violation type breakdown */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4">
          <p className="text-[length:13px] font-semibold text-[var(--text-primary)] mb-3">Violation Type Breakdown</p>
          {!typeAnalysis?.data?.length && (
            <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No violations in this period.</p>
          )}
          <div className="space-y-2">
            {typeAnalysis?.data?.map((t) => (
              <div key={t.violation_type_id} className="flex items-center gap-2">
                <span className="text-[length:12px] text-[var(--text-secondary)] w-28 shrink-0 truncate">{t.name}</span>
                <div className="flex-1 h-4 rounded bg-[var(--surface-page)] overflow-hidden">
                  <div
                    className="h-full rounded bg-[var(--brand)]"
                    style={{ width: `${(t.count / maxTypeCount) * 100}%` }}
                  />
                </div>
                <span className="text-[length:12px] font-semibold text-[var(--text-primary)] w-8 text-right shrink-0">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Repeat violators / counselling table */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4 overflow-x-auto">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[length:13px] font-semibold text-[var(--text-primary)]">
              Students Requiring Counselling
              {repeatData?.threshold != null && <span className="font-normal text-[var(--text-muted)]"> (&gt;{repeatData.threshold} violations)</span>}
            </p>
            {!!repeatData?.data?.length && (
              <Button size="xs" variant="light" loading={exporting} onClick={handleExportCounselling}>
                ⬇ Excel
              </Button>
            )}
          </div>
          {!repeatData?.data?.length ? (
            <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No repeat violators in this period.</p>
          ) : (
            <table className="w-full text-[length:12px]">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--divider)]">
                  <th className="pb-1.5 pr-3 font-medium">Student</th>
                  <th className="pb-1.5 pr-3 font-medium">Course</th>
                  <th className="pb-1.5 pr-3 font-medium">Year</th>
                  <th className="pb-1.5 pr-3 font-medium text-right">Count</th>
                  <th className="pb-1.5 font-medium">Main Issue</th>
                </tr>
              </thead>
              <tbody>
                {repeatData.data.map((s) => (
                  <tr key={s.student_id} className="border-b border-[var(--divider)] last:border-b-0">
                    <td className="py-1.5 pr-3">
                      <p className="font-medium text-[var(--text-primary)]">{s.student_name}</p>
                      <p className="text-[length:11px] text-[var(--text-muted)]">{s.registration_number}</p>
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--text-secondary)]">{COURSE_LABELS[s.course] ?? s.course}</td>
                    <td className="py-1.5 pr-3 text-[var(--text-secondary)]">{s.year}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold text-[var(--color-red-600)]">{s.violation_count}</td>
                    <td className="py-1.5 text-[var(--text-secondary)]">{s.main_issue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Violation trend — last 6 months, independent of the date-range filter */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4 mb-4">
        <p className="text-[length:13px] font-semibold text-[var(--text-primary)] mb-3">Violation Trend (last 6 months)</p>
        {!trendChartData.some((t) => t.count > 0) ? (
          <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No violations recorded in the last 6 months.</p>
        ) : (
          <LineChart
            h={220}
            data={trendChartData}
            dataKey="label"
            series={[{ name: 'count', label: 'Violations', color: 'blue.6' }]}
            curveType="monotone"
            withDots
            gridAxis="y"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Course-wise breakdown */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4">
          <p className="text-[length:13px] font-semibold text-[var(--text-primary)] mb-3">Violations by Course</p>
          {!courseChartData.length ? (
            <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No violations in this period.</p>
          ) : (
            <BarChart
              h={200}
              data={courseChartData}
              dataKey="course"
              series={[{ name: 'count', label: 'Violations', color: 'indigo.6' }]}
              gridAxis="y"
            />
          )}
        </div>

        {/* Academic year-wise breakdown */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4">
          <p className="text-[length:13px] font-semibold text-[var(--text-primary)] mb-3">Violations by Year</p>
          {!yearChartData.length ? (
            <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No violations in this period.</p>
          ) : (
            <BarChart
              h={200}
              data={yearChartData}
              dataKey="year"
              series={[{ name: 'count', label: 'Violations', color: 'violet.6' }]}
              gridAxis="y"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Faculty recording analysis */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4">
          <p className="text-[length:13px] font-semibold text-[var(--text-primary)] mb-3">Recorded By</p>
          {!facultyData?.data?.length ? (
            <p className="text-[length:13px] text-[var(--text-muted)] py-4 text-center">No violations in this period.</p>
          ) : (
            <div className="space-y-2">
              {facultyData.data.map((f) => (
                <div key={f.faculty_id} className="flex items-center gap-2">
                  <span className="text-[length:12px] text-[var(--text-secondary)] w-32 shrink-0 truncate">{f.name}</span>
                  <div className="flex-1 h-4 rounded bg-[var(--surface-page)] overflow-hidden">
                    <div className="h-full rounded bg-[var(--color-emerald-600)]" style={{ width: `${(f.count / maxFacultyCount) * 100}%` }} />
                  </div>
                  <span className="text-[length:12px] font-semibold text-[var(--text-primary)] w-8 text-right shrink-0">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar heatmap */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] p-4">
          <p className="text-[length:13px] font-semibold text-[var(--text-primary)] mb-3">Violation Heatmap</p>
          <ViolationHeatmap data={heatmapData?.data} max={heatmapData?.max} />
        </div>
      </div>
    </div>
  );
}

export default function ViolationsPage({ user }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage]       = useState(1);
  // `recorder` is '' (all), 'admin' (the Admin bucket), or a faculty id.
  const [filters, setFilters] = useState({ record_status: '', is_flagged: '', recorder: '' });
  const [deleting,  setDeleting]  = useState(null);
  const [showRecord, setShowRecord] = useState(false);

  // Translate the recorder selection into the API's recorded_by / faculty_id params.
  const query = useMemo(() => ({
    record_status: filters.record_status,
    is_flagged: filters.is_flagged,
    ...(filters.recorder === 'admin' ? { recorded_by: 'admin' } : filters.recorder ? { faculty_id: filters.recorder } : {}),
  }), [filters]);

  const { data, isLoading, isError, refetch } = useViolations({ ...query, page, limit: 20 });
  const { data: facultyData } = useUsers({ role: 'faculty' });
  const deleteViolation = useDeleteViolation();

  async function handleDelete() {
    try {
      await deleteViolation.mutateAsync({ id: deleting.id });
      toast({ message: 'Student violation deleted.' });
      setDeleting(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Student Violations' }]} />
      <PageHeader title="Student Violations" subtitle="Violation patterns, repeat offenders, and record management" />

      <DisciplineAnalytics />

      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[length:13px] font-semibold text-[var(--text-primary)]">All Records</p>
        <Button size="sm" onClick={() => setShowRecord(true)}>+ Record Student Violation</Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Select
          w={180}
          placeholder="All recorders"
          clearable
          value={filters.recorder || null}
          onChange={(value) => { setFilters(f => ({ ...f, recorder: value ?? '' })); setPage(1); }}
          // "Admin" is a single bucket = every admin-recorded violation; faculty are
          // listed individually.
          data={[
            { value: 'admin', label: 'Admin' },
            ...(facultyData?.data?.map((f) => ({ value: f.id, label: f.name })) || []),
          ]}
        />
        <Select
          w={144}
          placeholder="All status"
          clearable
          value={filters.record_status || null}
          onChange={(value) => { setFilters(f => ({ ...f, record_status: value ?? '' })); setPage(1); }}
          data={[
            { value: 'active', label: 'Active' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
        <Select
          w={144}
          placeholder="All"
          clearable
          value={filters.is_flagged || null}
          onChange={(value) => { setFilters(f => ({ ...f, is_flagged: value ?? '' })); setPage(1); }}
          data={[
            { value: 'true',  label: 'Flagged only' },
            { value: 'false', label: 'Not flagged' },
          ]}
        />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{ backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>Loading…</div>}
        {isError && <ErrorBlock onRetry={refetch} />}
        {!isLoading && !isError && !data?.data?.length && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>No student violations found.</div>}
        {data?.data?.map((v, i) => (
          <div key={v.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', backgroundColor: 'var(--surface-card)',
            borderBottom: '1px solid var(--border)', gap: 12,
            opacity: v.record_status === 'hidden' ? 0.6 : 1,
          }}>
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
              {(page - 1) * 20 + i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.student?.student_name}
              </p>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                {v.student?.registration_number} • {v.violationType?.name}
              </p>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                Recorded by: {recorderName(v.faculty)}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {v.is_flagged && <Badge status="pending" label="Flagged" />}
              <Badge status={v.record_status} />
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 4 }}>
              {v.is_flagged && !v.flag_resolved_at && (
                <Button variant="subtle" size="xs" onClick={() => navigate(ROUTES.ADMIN_FLAGGED_VIOLATIONS)}>Review</Button>
              )}
              <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(v)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>S.No</Th><Th>Student</Th><Th className="hidden md:table-cell">Recorded By</Th>
              <Th>Type</Th><Th>Fine (₹)</Th><Th>Status</Th><Th>Flagged</Th><Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={8} message="Loading…" />}
            {isError && <ErrorRow cols={8} onRetry={refetch} />}
            {!isLoading && !isError && !data?.data?.length && <EmptyRow cols={8} />}
            {data?.data?.map((v, i) => (
              <tr key={v.id} className={v.is_flagged ? 'bg-[var(--color-amber-bg)]' : v.record_status === 'hidden' ? 'opacity-50' : ''}>
                <Td>{(page - 1) * 20 + i + 1}</Td>
                <Td>
                  <p className="font-medium text-[var(--text-primary)]">{v.student?.student_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{v.student?.registration_number}</p>
                </Td>
                <Td className="hidden md:table-cell">{recorderName(v.faculty)}</Td>
                <Td>
                  {v.violationType?.name}
                  {v.custom_violation && <p className="text-xs text-[var(--text-muted)]">{v.custom_violation}</p>}
                </Td>
                <Td>{v.is_warning_only ? <span className="text-xs text-[var(--text-muted)]">Warning only</span> : `₹${v.fine_amount}`}</Td>
                <Td><Badge status={v.record_status} /></Td>
                <Td>{v.is_flagged && <Badge status="pending" label="Flagged" />}</Td>
                <Td>
                  <div className="flex gap-1">
                    {v.is_flagged && !v.flag_resolved_at && (
                      <Button variant="subtle" size="xs" onClick={() => navigate(ROUTES.ADMIN_FLAGGED_VIOLATIONS)}>Review</Button>
                    )}
                    <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(v)}>Delete</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Pagination meta={data?.meta} page={page} onPage={setPage} />

      <RecordViolationModal open={showRecord} onClose={() => setShowRecord(false)} adminMode />

      {deleting && (
        <ConfirmDialog
          open
          title="Delete Student Violation"
          message={
            <>
              Are you sure you want to delete this student violation record? This cannot be undone from the app.
              <br /><br />
              <strong>Student:</strong> {deleting.student?.student_name}<br />
              <strong>Violation:</strong> {deleting.violationType?.name}<br />
              <strong>Date:</strong> {deleting.dutySlot?.duty_date ? new Date(deleting.dutySlot.duty_date).toLocaleDateString('en-IN') : '—'}
            </>
          }
          confirmText="Delete Permanently"
          isDangerous
          isLoading={deleteViolation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Layout>
  );
}
