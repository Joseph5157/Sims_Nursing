import BottomDrawer, { cancelBtnStyle } from './ui/BottomDrawer';
import Badge from './ui/Badge';
import { useStudent } from '../hooks/useStudents';
import { useViolations } from '../hooks/useViolations';

const COURSE_LABELS = { b_pharm: 'B.Pharm', pharm_d: 'Pharm.D', m_pharm: 'M.Pharm' };

const sectionTitle = "text-[length:var(--text-micro)] font-[800] text-[color:var(--text-muted)] uppercase tracking-[0.12em]";

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--divider)] last:border-b-0">
      <span className="text-[length:var(--text-small)] text-[var(--text-muted)]">{label}</span>
      <span className="text-[length:var(--text-card)] font-medium text-[var(--text-primary)]">{value ?? '—'}</span>
    </div>
  );
}

function ViolationRow({ v }) {
  return (
    <div className="py-2.5 border-b border-[var(--divider)] last:border-b-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[length:var(--text-card)] font-semibold text-[var(--text-primary)] truncate">
          {v.violationType?.name}{v.custom_violation ? ` — ${v.custom_violation}` : ''}
        </p>
        <Badge status={v.record_status} />
      </div>
      <div className="flex items-center justify-between text-[length:var(--text-micro)] text-[var(--text-muted)]">
        <span>{v.dutySlot?.duty_date ? new Date(v.dutySlot.duty_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · {v.faculty?.name ?? 'Unknown faculty'}</span>
        <span className="font-semibold text-[var(--text-secondary)]">{v.is_warning_only ? 'Warning only' : `₹${v.fine_amount}`}</span>
      </div>
    </div>
  );
}

export default function StudentDetailsDrawer({ studentId, onClose }) {
  const { data: student, isLoading } = useStudent(studentId);
  const { data: violations, isLoading: violationsLoading } = useViolations(
    { student_id: studentId, limit: 100 },
    { enabled: !!studentId },
  );

  const violationList = violations?.data ?? [];
  const breakdown = new Map();
  for (const v of violationList) {
    const name = v.violationType?.name ?? 'Other';
    breakdown.set(name, (breakdown.get(name) ?? 0) + 1);
  }
  const breakdownEntries = Array.from(breakdown.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <BottomDrawer
      open={!!studentId}
      onClose={onClose}
      title={isLoading ? 'Loading…' : (student?.student_name ?? 'Student')}
      subtitle={student?.registration_number}
      footer={
        <button onClick={onClose} style={{ ...cancelBtnStyle, flex: 1 }}>Close</button>
      }
    >
      <div className="px-5 py-4 pb-2">
        {isLoading ? (
          <p className="text-[length:var(--text-card)] text-[var(--text-muted)]">Loading student…</p>
        ) : !student ? (
          <p className="text-[length:var(--text-card)] text-[var(--text-muted)]">Student not found.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Badge status={student.status} />
            </div>

            <p className={`${sectionTitle} mb-2`}>Academic</p>
            <div className="mb-4">
              <InfoRow label="Course" value={COURSE_LABELS[student.course] ?? student.course} />
              <InfoRow label="Year" value={student.year} />
              <InfoRow label="Semester" value={student.semester} />
              <InfoRow label="Batch year" value={student.batch_year} />
              <InfoRow label="Academic year" value={student.academic_year} />
            </div>

            <p className={`${sectionTitle} mb-2`}>Violation Summary</p>
            <div className="mb-4">
              <InfoRow label="Total Violations" value={violationsLoading ? '—' : violationList.length} />
              {!violationsLoading && breakdownEntries.map(([name, count]) => (
                <InfoRow key={name} label={name} value={count} />
              ))}
            </div>

            <p className={`${sectionTitle} mb-2`}>Complete Violation History</p>
            <div className="mb-2">
              {violationsLoading && <p className="text-[length:var(--text-card)] text-[var(--text-muted)] py-2">Loading…</p>}
              {!violationsLoading && !violationList.length && (
                <p className="text-[length:var(--text-card)] text-[var(--text-muted)] py-2">No student violations recorded.</p>
              )}
              {violationList.map((v) => <ViolationRow key={v.id} v={v} />)}
            </div>
          </>
        )}
      </div>
    </BottomDrawer>
  );
}
