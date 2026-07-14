import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorBlock } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import BottomDrawer from '../../components/ui/BottomDrawer';
import { useMediaQuery } from '@mantine/hooks';
import {
  useMonthlyAttendance, useLateArrivals, useAbsentFaculty, useAutoClockOut,
  useAttendanceOverrides, useStudentViolations, useFacultyActivity, useViolationTypeBreakdown, usePendingFines,
  useFlaggedViolations, useDutyCoverage, useUnassignedFacultyReport, useDutyReassignmentReport,
  useCompletionRate, useUploadHistory, useActiveStudents, useDailyViolationReport, useWeeklyViolationReport,
} from '../../hooks/useReports';
import { useAnalyticsFilterOptions } from '../../hooks/useAnalytics';
import { useUsers } from '../../hooks/useUsers';
import { useStudentSearch } from '../../hooks/useStudents';
import { useToast } from '../../components/ui/Toast';
import api from '../../utils/api';
import Breadcrumb from '../../components/Breadcrumb';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Report card definitions ────────────────────────────────────────────────────
const REPORTS = [
  // Attendance group
  { id: 'monthly-attendance',   group: 'Attendance',      emoji: '📊', color: 'bg-[var(--color-blue-100)]',   label: 'Monthly Attendance',   desc: 'Full attendance summary per faculty' },
  { id: 'late-arrivals',        group: 'Attendance',      emoji: '⏰', color: 'bg-[var(--color-amber-bg)]',  label: 'Late Arrivals',         desc: 'Faculty who checked in late' },
  { id: 'absent-faculty',       group: 'Attendance',      emoji: '❌', color: 'bg-[var(--color-red-bg)]',    label: 'Absent Faculty',        desc: 'Slots with no check-in recorded' },
  { id: 'auto-clockout',        group: 'Attendance',      emoji: '🕓', color: 'bg-[var(--color-orange-bg)]', label: 'Auto Clock-outs',       desc: 'System-clocked-out records' },
  // Student Violations group
  { id: 'faculty-activity',     group: 'Student Violations', emoji: '👤', color: 'bg-[var(--color-purple-bg)]', label: 'Faculty Activity',      desc: 'Student violations recorded per faculty' },
  { id: 'violation-types',      group: 'Student Violations', emoji: '🏷', color: 'bg-[var(--color-indigo-100)]', label: 'Type Breakdown',        desc: 'Student violations grouped by type' },
  { id: 'pending-fines',        group: 'Student Violations', emoji: '💰', color: 'bg-[var(--color-amber-bg)]', label: 'Pending Fines',         desc: 'Outstanding fine amounts' },
  { id: 'flagged-violations',   group: 'Student Violations', emoji: '⚑',  color: 'bg-[var(--color-amber-bg)]',  label: 'Flagged Student Violations', desc: 'Records flagged for Admin review' },
  // Duty & Coverage group
  { id: 'duty-coverage',        group: 'Duty & Coverage', emoji: '📅', color: 'bg-[var(--color-emerald-bg)]',  label: 'Duty Coverage',         desc: 'Monthly slot completion stats' },
  { id: 'unassigned-faculty',   group: 'Duty & Coverage', emoji: '👥', color: 'bg-[var(--color-amber-bg)]',  label: 'Unassigned Faculty',    desc: 'Faculty without full slot allocation' },
  { id: 'duty-reassignments',   group: 'Duty & Coverage', emoji: '🔄', color: 'bg-[var(--color-indigo-bg)]', label: 'Duty Reassignments',    desc: 'Reassignment history and per-faculty duty counts' },
  { id: 'completion-rate',      group: 'Duty & Coverage', emoji: '📈', color: 'bg-[var(--color-emerald-bg)]',   label: 'Completion Rate',       desc: 'Month-by-month session completion %' },
  // Students group
  { id: 'attendance-overrides', group: 'Students',        emoji: '✏️', color: 'bg-[var(--color-red-bg)]',   label: 'Override Log',          desc: 'Admin-overridden attendance records' },
  { id: 'upload-history',       group: 'Students',        emoji: '📤', color: 'bg-[var(--color-blue-100)]',   label: 'Upload History',        desc: 'Excel upload log with error counts' },
  { id: 'active-students',      group: 'Students',        emoji: '🎓', color: 'bg-[var(--color-emerald-bg)]',  label: 'Active Students',       desc: 'Student roster breakdown by course' },
];

const REPORT_GROUPS = ['Attendance', 'Student Violations', 'Duty & Coverage', 'Students'];

// ── Month filter ───────────────────────────────────────────────────────────────
function MonthFilter({ year, month, setYear, setMonth }) {
  const now = new Date();
  const cls = 'border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)] bg-[var(--surface-card)] text-[var(--text-secondary)]';
  const controlStyle = { fontSize: 16 };
  return (
    <div className="flex gap-2 mb-5">
      <select value={year} onChange={(e) => setYear(+e.target.value)} className={cls} style={controlStyle}>
        {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y}>{y}</option>)}
      </select>
      <select value={month} onChange={(e) => setMonth(+e.target.value)} className={cls} style={controlStyle}>
        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
    </div>
  );
}

// ── Report result content ──────────────────────────────────────────────────────
// A violation's recorder is a faculty member on duty OR an admin who recorded it
// directly. Admin recorders surface as "Admin"; faculty as their name.
function recorderName(faculty) {
  if (!faculty) return '—';
  return faculty.role === 'admin' || faculty.role === 'super_admin' ? 'Admin' : faculty.name;
}

function ReportSection({ id, data, isLoading, isError, refetch }) {
  if (isLoading) return <p className="text-[length:13px] text-[var(--text-muted)]">Loading…</p>;
  if (isError)   return <ErrorBlock onRetry={refetch} />;
  if (!data)     return null;

  switch (id) {
    case 'monthly-attendance': return (
      <Table>
        <thead><tr><Th>Faculty</Th><Th>Dept</Th><Th>Total</Th><Th>Completed</Th><Th>Absent</Th><Th>Late</Th><Th>Auto-out</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={7} />}
          {data.data?.map((r, i) => (
            <tr key={i}>
              <Td className="font-medium">{r.faculty?.name}</Td>
              <Td>{r.faculty?.department ?? '—'}</Td>
              <Td>{r.total}</Td><Td>{r.completed}</Td><Td>{r.absent}</Td><Td>{r.late}</Td><Td>{r.auto_out}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'late-arrivals': case 'auto-clockout': return (
      <Table>
        <thead><tr><Th>Faculty</Th><Th>Date</Th><Th>Session</Th><Th>In time</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={4} />}
          {data.data?.map((r) => (
            <tr key={r.id}>
              <Td className="font-medium">{r.faculty?.name}</Td>
              <Td>{new Date(r.dutySlot?.duty_date).toLocaleDateString('en-IN')}</Td>
              <Td className="capitalize">{r.dutySlot?.session_type}</Td>
              <Td>{r.in_time ? new Date(r.in_time).toLocaleTimeString() : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'absent-faculty': return (
      <Table>
        <thead><tr><Th>Faculty</Th><Th>Date</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={3} />}
          {data.data?.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.faculty?.name}</Td>
              <Td>{new Date(s.duty_date).toLocaleDateString('en-IN')}</Td>
              <Td><Badge status={s.status} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'attendance-overrides': return (
      <Table>
        <thead><tr><Th>Faculty</Th><Th>Date</Th><Th>Overridden by</Th><Th>Reason</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={4} />}
          {data.data?.map((r) => (
            <tr key={r.id}>
              <Td>{r.faculty?.name}</Td>
              <Td>{new Date(r.dutySlot?.duty_date).toLocaleDateString('en-IN')}</Td>
              <Td>{r.overriddenBy?.name}</Td>
              <Td className="text-[length:12px] text-[var(--text-muted)] max-w-xs truncate">{r.override_reason}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'faculty-activity': return (
      <Table>
        <thead><tr><Th>Recorded By</Th><Th>Dept</Th><Th>Student Violations</Th><Th>Total Fines (₹)</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={4} />}
          {data.data?.map((r, i) => (
            <tr key={i}>
              <Td className="font-medium">{recorderName(r.faculty)}</Td>
              <Td>{r.faculty?.department ?? '—'}</Td>
              <Td>{r.violation_count}</Td>
              <Td>₹{Number(r.total_fines).toFixed(2)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'violation-types': return (
      <Table>
        <thead><tr><Th>Type</Th><Th>Count</Th><Th>Total Fines (₹)</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={3} />}
          {data.data?.map((r, i) => (
            <tr key={i}>
              <Td className="font-medium">{r.type?.name}</Td>
              <Td>{r.count}</Td>
              <Td>₹{Number(r.total_fines).toFixed(2)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'pending-fines': return (
      <>
        <p className="text-[length:13px] font-semibold text-[var(--text-secondary)] mb-3">
          Total outstanding: ₹{data.total_fine_amount} across {data.total} violations
        </p>
        <Table>
          <thead><tr><Th>S.No</Th><Th>Student</Th><Th>Reg. No.</Th><Th>Course</Th><Th>Type</Th><Th>Fine (₹)</Th></tr></thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {data.data?.map((v, i) => (
              <tr key={v.id}>
                <Td>{i + 1}</Td>
                <Td className="font-medium">{v.student?.student_name}</Td>
                <Td className="font-mono text-[length:12px]">{v.student?.registration_number}</Td>
                <Td>{v.student?.course}</Td>
                <Td>{v.violationType?.name}</Td>
                <Td className="font-semibold">₹{v.fine_amount}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </>
    );

    case 'flagged-violations': return (
      <>
        <div className="flex gap-4 mb-3 text-[length:13px]">
          <span className="text-[var(--color-amber-solid)] font-medium">Pending: {data.pending_count}</span>
          <span className="text-[var(--color-emerald-solid)] font-medium">Resolved: {data.resolved_count}</span>
        </div>
        <Table>
          <thead><tr><Th>S.No</Th><Th>Student</Th><Th>Recorded By</Th><Th>Type</Th><Th>Flag note</Th><Th>Resolved</Th></tr></thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {data.data?.map((v, i) => (
              <tr key={v.id}>
                <Td>{i + 1}</Td>
                <Td>{v.student?.student_name}</Td>
                <Td>{recorderName(v.faculty)}</Td>
                <Td>{v.violationType?.name}</Td>
                <Td className="text-[length:12px] text-[var(--text-muted)] max-w-xs truncate">{v.flag_note}</Td>
                <Td>{v.flag_resolved_at ? <Badge status="active" label="Resolved" /> : <Badge status="pending" label="Pending" />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </>
    );

    case 'duty-coverage': return (
      <div className="grid grid-cols-3 gap-3">
        {[['Total slots', data.total], ['Completed', data.completed], ['Absent', data.absent],
          ['Scheduled', data.scheduled], ['Morning', data.morning], ['Afternoon', data.afternoon],
          ['Completion rate', `${data.completion_rate}%`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface-container-low rounded-xl p-4">
            <p className="text-[length:11px] text-[var(--text-muted)]">{label}</p>
            <p className="text-[length:20px] font-bold text-[var(--text-primary)] mt-1">{value}</p>
          </div>
        ))}
      </div>
    );

    case 'unassigned-faculty': return (
      <Table>
        <thead><tr><Th>Faculty</Th><Th>Dept</Th><Th>Picked</Th><Th>Required</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={4} message="All faculty have picked their slots." />}
          {data.data?.map((f) => (
            <tr key={f.id}>
              <Td className="font-medium">{f.name}</Td>
              <Td>{f.department ?? '—'}</Td>
              <Td>{f.slots_picked}</Td>
              <Td>{f.required}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'duty-reassignments': return (
      <div className="flex flex-col gap-6">
        {/* Per-faculty duty counts */}
        <div>
          <h4 className="text-[length:13px] font-semibold text-[var(--text-secondary)] mb-2">Duty counts</h4>
          <Table>
            <thead><tr><Th>Faculty</Th><Th>Regular</Th><Th>Received</Th><Th>Reassigned away</Th><Th>Final duties</Th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {!data.counts?.length && <EmptyRow cols={5} />}
              {data.counts?.map((c) => (
                <tr key={c.faculty_id}>
                  <Td className="font-medium">{c.name}</Td>
                  <Td>{c.regular}</Td>
                  <Td>{c.received}</Td>
                  <Td>{c.away}</Td>
                  <Td className="font-semibold">{c.final}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {/* Reassignment history */}
        <div>
          <h4 className="text-[length:13px] font-semibold text-[var(--text-secondary)] mb-2">Reassignment history</h4>
          <Table>
            <thead><tr><Th>Date</Th><Th>Session</Th><Th>From</Th><Th>To</Th><Th>Reason</Th><Th>By</Th><Th>Attendance</Th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {!data.history?.length && <EmptyRow cols={7} message="No reassignments this month." />}
              {data.history?.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{new Date(r.duty_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Td>
                  <Td className="capitalize">{r.session_type}</Td>
                  <Td>{r.from_faculty?.name}</Td>
                  <Td>{r.to_faculty?.name}</Td>
                  <Td className="text-[length:12px] text-[var(--text-muted)]">{r.reason ?? '—'}</Td>
                  <Td>{r.reassigned_by?.name}</Td>
                  <Td className="capitalize">{r.final_attendance?.replace('_', ' ')}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    );

    case 'completion-rate': return (
      <Table>
        <thead><tr><Th>Month</Th><Th>Total slots</Th><Th>Completed</Th><Th>Rate</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {data.data?.map((r) => (
            <tr key={`${r.year}-${r.month}`}>
              <Td className="font-medium">{MONTHS[r.month - 1]} {r.year}</Td>
              <Td>{r.total}</Td>
              <Td>{r.completed}</Td>
              <Td>
                <span className={`font-semibold ${parseFloat(r.rate) >= 80 ? 'text-[var(--color-emerald-solid)]' : 'text-[var(--color-red-solid)]'}`}>
                  {r.rate}%
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'upload-history': return (
      <Table>
        <thead><tr><Th>Filename</Th><Th>Uploaded by</Th><Th>Added</Th><Th>Updated</Th><Th>Deactivated</Th><Th>Errors</Th><Th>Date</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={7} />}
          {data.data?.map((log) => (
            <tr key={log.id}>
              <Td className="font-mono text-[length:12px]">{log.filename}</Td>
              <Td>{log.uploader?.name}</Td>
              <Td>{log.added_count}</Td><Td>{log.updated_count}</Td><Td>{log.deactivated_count}</Td>
              <Td>{Array.isArray(log.errors) ? log.errors.length : 0}</Td>
              <Td className="text-[length:12px]">{new Date(log.uploaded_at).toLocaleDateString('en-IN')}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    case 'active-students': return (
      <>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(data.breakdown ?? {}).map(([key, count]) => (
            <span key={key} className="bg-[var(--color-blue-50)] text-[var(--brand)] text-[length:12px] px-3 py-1 rounded-full">
              {key}: {count}
            </span>
          ))}
        </div>
        <p className="text-[length:13px] text-[var(--text-muted)]">Total: <strong>{data.total}</strong> active students</p>
      </>
    );

    case 'student-violations': return (
      <Table>
        <thead><tr><Th>S.No</Th><Th>Student</Th><Th>Reg. No.</Th><Th>Type</Th><Th>Recorded By</Th><Th>Date</Th></tr></thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {!data.data?.length && <EmptyRow cols={6} />}
          {data.data?.map((v, i) => (
            <tr key={v.id}>
              <Td>{i + 1}</Td>
              <Td className="font-medium">{v.student?.student_name}</Td>
              <Td className="font-mono text-[length:12px]">{v.student?.registration_number}</Td>
              <Td>{v.violationType?.name}</Td>
              <Td>{recorderName(v.faculty)}</Td>
              <Td className="text-[length:12px]">{new Date(v.created_at).toLocaleDateString('en-IN')}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    default: return <pre className="text-[length:12px] text-[var(--text-muted)] overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  }
}

// ── Student Monthly Violation Report — the primary report (Monthly / Yearly / Overall + Excel export) ──
const selectCls = 'border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--brand)] bg-[var(--surface-card)] text-[var(--text-secondary)]';

function StudentViolationReportCard() {
  const toast = useToast();
  const now = new Date();
  const [mode, setMode]   = useState('monthly'); // 'monthly' | 'yearly' | 'overall' | 'daily' | 'weekly'
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyDate, setDailyDate] = useState(now.toISOString().split('T')[0]);
  const [weeklyFromDate, setWeeklyFromDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString().split('T')[0]);
  const [weeklyToDate, setWeeklyToDate] = useState(now.toISOString().split('T')[0]);
  const [downloading, setDownloading] = useState(false);

  // ── Filters (Course / Academic Year / Violation Type / Faculty) ──────────
  const { data: filterOptions } = useAnalyticsFilterOptions();
  const { data: facultyData }   = useUsers({ role: 'faculty', status: 'active' });
  const [course, setCourse]                 = useState('');
  const [studentYear, setStudentYear]       = useState('');
  const [violationTypeId, setViolationTypeId] = useState('');
  const [facultyId, setFacultyId]           = useState('');

  const filterParams = {
    ...(course && { course }),
    ...(studentYear && { student_year: studentYear }),
    ...(violationTypeId && { violation_type_id: violationTypeId }),
    // "admin" is the Admin recorder bucket; any other value is a specific faculty id.
    ...(facultyId === 'admin' ? { recorded_by: 'admin' } : facultyId ? { faculty_id: facultyId } : {}),
  };

  const params = { ...(mode === 'monthly' ? { year, month } : mode === 'yearly' ? { year } : {}), ...filterParams };
  const { data, isLoading, isError, refetch } = useStudentViolations(params);
  const { data: dailyData, isLoading: dailyLoading, isError: dailyError, refetch: refetchDaily } = useDailyViolationReport(mode === 'daily' ? dailyDate : null, filterParams);
  const { data: weeklyData, isLoading: weeklyLoading, isError: weeklyError, refetch: refetchWeekly } = useWeeklyViolationReport(mode === 'weekly' ? weeklyFromDate : null, mode === 'weekly' ? weeklyToDate : null, filterParams);

  async function handleDownload(format = 'xlsx') {
    setDownloading(true);
    try {
      const variant = format === 'pdf' ? 'pdf' : 'export';
      let endpoint;
      let downloadParams;
      let filename = '';

      if (mode === 'daily') {
        endpoint = `/reports/student-violations/daily/${dailyDate}/${variant}`;
        downloadParams = filterParams;
        filename = `student-violations-daily-${dailyDate}`;
      } else if (mode === 'weekly') {
        endpoint = `/reports/student-violations/weekly/${variant}`;
        downloadParams = { from_date: weeklyFromDate, to_date: weeklyToDate, ...filterParams };
        filename = `student-violations-weekly-${weeklyFromDate}-to-${weeklyToDate}`;
      } else {
        endpoint = `/reports/student-violations/${variant}`;
        downloadParams = params;
        const suffix = mode === 'monthly' ? `${year}-${String(month).padStart(2, '0')}` : mode === 'yearly' ? String(year) : 'all-time';
        filename = `student-violations-${suffix}`;
      }

      const res = await api.get(endpoint, { params: downloadParams, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: 'Could not download report.', type: 'error' });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-[var(--surface-card)] border-2 border-[var(--brand)] rounded-2xl p-5 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-[length:var(--text-micro)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--brand)] mb-1">Main report</p>
          <h2 className="text-[length:16px] font-bold text-[var(--text-primary)]">⚠️ Student Violation Report</h2>
          <p className="text-[length:13px] text-[var(--text-muted)] mt-0.5">All recorded student violations — daily, weekly, monthly, yearly, or overall</p>
        </div>
        <div className="shrink-0 flex gap-2">
          <button
            type="button"
            onClick={() => handleDownload('xlsx')}
            disabled={downloading || ((mode === 'monthly' || mode === 'yearly' || mode === 'overall') && isLoading) || (mode === 'daily' && !dailyData?.data?.length) || (mode === 'weekly' && !weeklyData?.data?.length) || (mode !== 'daily' && mode !== 'weekly' && !data?.data?.length)}
            className="h-10 px-4 rounded-lg font-semibold text-[length:13px] text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            {downloading ? 'Preparing…' : '⬇ Excel'}
          </button>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={downloading || ((mode === 'monthly' || mode === 'yearly' || mode === 'overall') && isLoading) || (mode === 'daily' && !dailyData?.data?.length) || (mode === 'weekly' && !weeklyData?.data?.length) || (mode !== 'daily' && mode !== 'weekly' && !data?.data?.length)}
            className="h-10 px-4 rounded-lg font-semibold text-[length:13px] text-[var(--text-secondary)] bg-[var(--surface-page)] border border-[var(--border)] hover:border-[var(--color-blue-300)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {downloading ? 'Preparing…' : '⬇ PDF'}
          </button>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['monthly', 'Monthly'], ['yearly', 'Yearly'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['overall', 'Overall']].map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3.5 py-1.5 rounded-lg text-[length:13px] font-semibold transition-colors cursor-pointer border ${
              mode === m
                ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                : 'bg-[var(--surface-page)] text-[var(--text-secondary)] border-[var(--border)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date pickers depending on mode */}
      {mode !== 'overall' && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {(mode === 'monthly' || mode === 'yearly') && (
            <>
              <select value={year} onChange={(e) => setYear(+e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
              </select>
              {mode === 'monthly' && (
                <select value={month} onChange={(e) => setMonth(+e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              )}
            </>
          )}
          {mode === 'daily' && (
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className={selectCls}
              style={{ fontSize: 16 }}
            />
          )}
          {mode === 'weekly' && (
            <>
              <input
                type="date"
                value={weeklyFromDate}
                onChange={(e) => setWeeklyFromDate(e.target.value)}
                className={selectCls}
                style={{ fontSize: 16 }}
                placeholder="From"
              />
              <input
                type="date"
                value={weeklyToDate}
                onChange={(e) => setWeeklyToDate(e.target.value)}
                className={selectCls}
                style={{ fontSize: 16 }}
                placeholder="To"
              />
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
          <option value="">All Courses</option>
          {(filterOptions?.courses ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={studentYear} onChange={(e) => setStudentYear(e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
          <option value="">All Years</option>
          {(filterOptions?.years ?? []).map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select value={violationTypeId} onChange={(e) => setViolationTypeId(e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
          <option value="">All Violation Types</option>
          {(filterOptions?.violation_types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
          <option value="">All Recorders</option>
          <option value="admin">Admin</option>
          {(facultyData?.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {!isLoading && data && mode !== 'daily' && mode !== 'weekly' && (
        <p className="text-[length:12px] text-[var(--text-muted)] mb-3">
          Showing {data.shown ?? data.data?.length ?? 0} of {data.total ?? 0} student violation{(data.total ?? 0) === 1 ? '' : 's'}
        </p>
      )}

      {!dailyLoading && dailyData && mode === 'daily' && (
        <p className="text-[length:12px] text-[var(--text-muted)] mb-3">
          {dailyData.data?.length ?? 0} violation{(dailyData.data?.length ?? 0) === 1 ? '' : 's'} on {new Date(dailyDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {!weeklyLoading && weeklyData && mode === 'weekly' && (
        <p className="text-[length:12px] text-[var(--text-muted)] mb-3">
          {weeklyData.data?.length ?? 0} violation{(weeklyData.data?.length ?? 0) === 1 ? '' : 's'} from {new Date(weeklyFromDate).toLocaleDateString('en-IN')} to {new Date(weeklyToDate).toLocaleDateString('en-IN')}
        </p>
      )}

      {mode === 'daily' && <ReportSection id="student-violations" data={dailyData} isLoading={dailyLoading} isError={dailyError} refetch={refetchDaily} />}
      {mode === 'weekly' && <ReportSection id="student-violations" data={weeklyData} isLoading={weeklyLoading} isError={weeklyError} refetch={refetchWeekly} />}
      {mode !== 'daily' && mode !== 'weekly' && <ReportSection id="student-violations" data={data} isLoading={isLoading} isError={isError} refetch={refetch} />}
    </div>
  );
}

// ── Individual Student Violation Report — full violation history for one student ──
// Reuses the same /reports/student-violations endpoints as the main card, scoped
// to a single student_id (studentViolationWhere already supports it), so PDF/Excel
// exports carry the identical no-Fine column set.
function IndividualStudentReportCard() {
  const toast = useToast();
  const now = new Date();
  const [student, setStudent] = useState(null); // { id, student_name, registration_number, course, academic_year }
  const [query, setQuery]     = useState('');
  const [mode, setMode]       = useState('overall');
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [dailyDate, setDailyDate] = useState(now.toISOString().split('T')[0]);
  const [weeklyFromDate, setWeeklyFromDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString().split('T')[0]);
  const [weeklyToDate, setWeeklyToDate] = useState(now.toISOString().split('T')[0]);
  const [downloading, setDownloading] = useState(false);

  const { data: searchData, isLoading: searching } = useStudentSearch(query);
  const results = searchData?.data ?? [];

  // Every query below is gated on a selected student so we never fetch all-students data.
  const sid = student?.id ?? null;
  const filterParams = sid ? { student_id: sid } : {};
  const params = { ...(mode === 'monthly' ? { year, month } : mode === 'yearly' ? { year } : {}), ...filterParams };

  // Gate the fetch on a selected student so we never pull the all-students report.
  const { data, isLoading, isError, refetch } =
    useStudentViolations(params, { enabled: !!sid && mode !== 'daily' && mode !== 'weekly' });
  const { data: dailyData, isLoading: dailyLoading, isError: dailyError, refetch: refetchDaily } =
    useDailyViolationReport(sid && mode === 'daily' ? dailyDate : null, filterParams);
  const { data: weeklyData, isLoading: weeklyLoading, isError: weeklyError, refetch: refetchWeekly } =
    useWeeklyViolationReport(sid && mode === 'weekly' ? weeklyFromDate : null, sid && mode === 'weekly' ? weeklyToDate : null, filterParams);

  async function handleDownload(format = 'xlsx') {
    if (!student) return;
    setDownloading(true);
    try {
      const variant = format === 'pdf' ? 'pdf' : 'export';
      let endpoint, downloadParams, filename;
      const reg = student.registration_number;

      if (mode === 'daily') {
        endpoint = `/reports/student-violations/daily/${dailyDate}/${variant}`;
        downloadParams = filterParams;
        filename = `student-${reg}-daily-${dailyDate}`;
      } else if (mode === 'weekly') {
        endpoint = `/reports/student-violations/weekly/${variant}`;
        downloadParams = { from_date: weeklyFromDate, to_date: weeklyToDate, ...filterParams };
        filename = `student-${reg}-weekly-${weeklyFromDate}-to-${weeklyToDate}`;
      } else {
        endpoint = `/reports/student-violations/${variant}`;
        downloadParams = params;
        const suffix = mode === 'monthly' ? `${year}-${String(month).padStart(2, '0')}` : mode === 'yearly' ? String(year) : 'all-time';
        filename = `student-${reg}-${suffix}`;
      }

      const res = await api.get(endpoint, { params: downloadParams, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: 'Could not download report.', type: 'error' });
    } finally {
      setDownloading(false);
    }
  }

  const hasRows =
    mode === 'daily'  ? !!dailyData?.data?.length :
    mode === 'weekly' ? !!weeklyData?.data?.length :
    !!data?.data?.length;
  const busy =
    mode === 'daily'  ? dailyLoading :
    mode === 'weekly' ? weeklyLoading :
    isLoading;

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-[length:var(--text-micro)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--text-muted)] mb-1">By student</p>
          <h2 className="text-[length:16px] font-bold text-[var(--text-primary)]">🎓 Individual Student Violation Report</h2>
          <p className="text-[length:13px] text-[var(--text-muted)] mt-0.5">Complete violation history for one student — for counselling, parent meetings, and reviews</p>
        </div>
        <div className="shrink-0 flex gap-2">
          <button
            type="button"
            onClick={() => handleDownload('xlsx')}
            disabled={!student || downloading || busy || !hasRows}
            className="h-10 px-4 rounded-lg font-semibold text-[length:13px] text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            {downloading ? 'Preparing…' : '⬇ Excel'}
          </button>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={!student || downloading || busy || !hasRows}
            className="h-10 px-4 rounded-lg font-semibold text-[length:13px] text-[var(--text-secondary)] bg-[var(--surface-page)] border border-[var(--border)] hover:border-[var(--color-blue-300)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {downloading ? 'Preparing…' : '⬇ PDF'}
          </button>
        </div>
      </div>

      {/* Student search-and-pick */}
      {!student ? (
        <div className="relative mb-5 max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student by name or registration number…"
            className={`${selectCls} w-full`}
            style={{ fontSize: 16 }}
          />
          {query.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-card)] shadow-[var(--shadow-dropdown)]">
              {searching && <p className="px-3 py-2 text-[length:13px] text-[var(--text-muted)]">Searching…</p>}
              {!searching && !results.length && <p className="px-3 py-2 text-[length:13px] text-[var(--text-muted)]">No students found.</p>}
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setStudent(s); setQuery(''); }}
                  className="block w-full text-left px-3 py-2 hover:bg-[var(--surface-page)] border-b border-[var(--divider)] last:border-b-0"
                >
                  <span className="text-[length:13px] font-medium text-[var(--text-primary)]">{s.student_name}</span>
                  <span className="text-[length:12px] text-[var(--text-muted)] ml-2">{s.registration_number} · {s.course}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="rounded-lg border border-[var(--brand)] bg-[var(--color-blue-50)] px-3 py-2">
            <span className="text-[length:13px] font-semibold text-[var(--text-primary)]">{student.student_name}</span>
            <span className="text-[length:12px] text-[var(--text-muted)] ml-2">{student.registration_number} · {student.course}{student.academic_year ? ` · ${student.academic_year}` : ''}</span>
          </div>
          <button
            type="button"
            onClick={() => { setStudent(null); setQuery(''); }}
            className="text-[length:13px] font-semibold text-[var(--brand)] cursor-pointer bg-transparent border-none"
          >
            Change student
          </button>
        </div>
      )}

      {student && (
        <>
          {/* Mode switcher */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[['monthly', 'Monthly'], ['yearly', 'Yearly'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['overall', 'Overall History']].map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-lg text-[length:13px] font-semibold transition-colors cursor-pointer border ${
                  mode === m
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'bg-[var(--surface-page)] text-[var(--text-secondary)] border-[var(--border)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date pickers depending on mode */}
          {mode !== 'overall' && (
            <div className="flex gap-2 mb-5 flex-wrap">
              {(mode === 'monthly' || mode === 'yearly') && (
                <>
                  <select value={year} onChange={(e) => setYear(+e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y}>{y}</option>)}
                  </select>
                  {mode === 'monthly' && (
                    <select value={month} onChange={(e) => setMonth(+e.target.value)} className={selectCls} style={{ fontSize: 16 }}>
                      {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  )}
                </>
              )}
              {mode === 'daily' && (
                <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className={selectCls} style={{ fontSize: 16 }} />
              )}
              {mode === 'weekly' && (
                <>
                  <input type="date" value={weeklyFromDate} onChange={(e) => setWeeklyFromDate(e.target.value)} className={selectCls} style={{ fontSize: 16 }} />
                  <input type="date" value={weeklyToDate} onChange={(e) => setWeeklyToDate(e.target.value)} className={selectCls} style={{ fontSize: 16 }} />
                </>
              )}
            </div>
          )}

          {mode === 'daily'  && <ReportSection id="student-violations" data={dailyData}  isLoading={dailyLoading}  isError={dailyError}  refetch={refetchDaily} />}
          {mode === 'weekly' && <ReportSection id="student-violations" data={weeklyData} isLoading={weeklyLoading} isError={weeklyError} refetch={refetchWeekly} />}
          {mode !== 'daily' && mode !== 'weekly' && <ReportSection id="student-violations" data={data} isLoading={isLoading} isError={isError} refetch={refetch} />}
        </>
      )}
    </div>
  );
}

// ── Report view (runs the hook for selected report) ────────────────────────────
const NO_MONTH = ['pending-fines','flagged-violations','upload-history','active-students','completion-rate'];

function ReportView({ id }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const needsMonth = !NO_MONTH.includes(id);
  const params = needsMonth ? { year, month } : {};

  const hookMap = {
    'monthly-attendance':   useMonthlyAttendance,
    'late-arrivals':        useLateArrivals,
    'absent-faculty':       useAbsentFaculty,
    'auto-clockout':        useAutoClockOut,
    'attendance-overrides': useAttendanceOverrides,
    'faculty-activity':     useFacultyActivity,
    'violation-types':      useViolationTypeBreakdown,
    'pending-fines':        usePendingFines,
    'flagged-violations':   useFlaggedViolations,
    'duty-coverage':        useDutyCoverage,
    'unassigned-faculty':   useUnassignedFacultyReport,
    'duty-reassignments':   useDutyReassignmentReport,
    'completion-rate':      useCompletionRate,
    'upload-history':       useUploadHistory,
    'active-students':      useActiveStudents,
  };
  const useHook = hookMap[id] ?? useFlaggedViolations;
  const { data, isLoading, isError, refetch } = useHook(params);

  return (
    <div>
      {needsMonth && <MonthFilter year={year} month={month} setYear={setYear} setMonth={setMonth} />}
      <ReportSection id={id} data={data} isLoading={isLoading} isError={isError} refetch={refetch} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage({ user }) {
  const [active, setActive] = useState(null);
  const isMobile = useMediaQuery('(max-width: 639px)');

  const activeReport = REPORTS.find((r) => r.id === active);

  const reportContent = active && (
    <div className="p-5">
      <ReportView key={active} id={active} />
    </div>
  );

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Reports' }]} />
      <PageHeader title="Reports" subtitle="2 primary reports + 15 secondary reports" />

      <StudentViolationReportCard />
      <IndividualStudentReportCard />

      <p className="text-[length:var(--text-micro)] font-bold uppercase tracking-[var(--tracking-wide)] text-[color:var(--text-muted)] mb-3">
        Secondary reports
      </p>

      {/* Grouped report cards */}
      {REPORT_GROUPS.map((group) => (
        <div key={group} className="mb-6">
          <p className="text-[length:var(--text-micro)] font-bold uppercase tracking-[var(--tracking-wide)] text-[color:var(--text-muted)] mb-2">
            {group}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {REPORTS.filter((r) => r.group === group).map((r) => (
              <button
                key={r.id}
                onClick={() => setActive(active === r.id ? null : r.id)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  active === r.id
                    ? 'border-[var(--brand)] bg-[var(--color-blue-50)] shadow-sm'
                    : 'border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--color-blue-300)] hover:bg-[var(--surface-page)]'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg ${r.color} flex items-center justify-center text-[length:18px] mb-3`}>
                  {r.emoji}
                </div>
                <p className="text-[length:13px] font-semibold text-[var(--text-primary)] leading-snug">{r.label}</p>
                <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] mt-0.5 leading-snug">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Mobile: BottomDrawer for report results */}
      {isMobile && (
        <BottomDrawer
          open={!!active}
          onClose={() => setActive(null)}
          title={activeReport?.label ?? ''}
          subtitle={activeReport?.desc}
        >
          {reportContent}
        </BottomDrawer>
      )}

      {/* Desktop: inline result panel */}
      {!isMobile && active && (
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[length:14px] font-semibold text-[var(--text-primary)]">
              {activeReport?.emoji} {activeReport?.label}
            </h2>
            <button
              onClick={() => setActive(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[length:18px] leading-none cursor-pointer bg-transparent border-none"
            >
              ✕
            </button>
          </div>
          <ReportView key={active} id={active} />
        </div>
      )}
    </Layout>
  );
}
