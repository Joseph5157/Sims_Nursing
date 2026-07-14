import { useEffect, useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { NumberInput, Button, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useToast } from '../../components/ui/Toast';
import { useDutyTimingSettings, useUpdateDutyTimingSettings } from '../../hooks/useDutyTimingSettings';
import Breadcrumb from '../../components/Breadcrumb';

const FIELDS = [
  'session_start_morning_hour', 'session_start_morning_min',
  'session_start_afternoon_hour', 'session_start_afternoon_min',
  'late_threshold_morning_hour', 'late_threshold_morning_min',
  'late_threshold_afternoon_hour', 'late_threshold_afternoon_min',
  'auto_checkout_morning_hour', 'auto_checkout_morning_min',
  'auto_checkout_afternoon_hour', 'auto_checkout_afternoon_min',
];

const ROWS = [
  { key: 'session_start', label: 'Session start', description: 'When this session begins' },
  { key: 'late_threshold', label: 'Late-arrival cutoff', description: 'Check-in after this time is flagged late' },
  { key: 'auto_checkout', label: 'Auto clock-out', description: 'Unchecked-out faculty are clocked out at this time' },
];

function TimeRow({ label, description, hourKey, minKey, form, setForm }) {
  return (
    <div className="grid grid-cols-[1fr_64px_64px] items-center gap-x-2 py-2 border-b border-b-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-1.5 min-w-0 pr-2">
        <span className="text-[13px] text-[var(--text-secondary)] truncate">{label}</span>
        <Tooltip label={description} withArrow position="top" multiline w={200}>
          <IconInfoCircle size={13} className="shrink-0 text-[var(--text-muted)]" />
        </Tooltip>
      </div>
      <NumberInput
        aria-label={`${label} hour`}
        size="sm"
        hideControls
        min={0} max={23} allowDecimal={false}
        value={form[hourKey]}
        onChange={(v) => setForm((f) => ({ ...f, [hourKey]: typeof v === 'number' ? v : 0 }))}
      />
      <NumberInput
        aria-label={`${label} minute`}
        size="sm"
        hideControls
        min={0} max={59} allowDecimal={false}
        value={form[minKey]}
        onChange={(v) => setForm((f) => ({ ...f, [minKey]: typeof v === 'number' ? v : 0 }))}
      />
    </div>
  );
}

function SessionSection({ session, form, setForm }) {
  const label = session === 'morning' ? 'Morning' : 'Afternoon';
  return (
    <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-3.5">
      <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{label} session</p>
      <div className="grid grid-cols-[1fr_64px_64px] gap-x-2 pb-1">
        <span />
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] text-center">Hour</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] text-center">Min</span>
      </div>
      {ROWS.map((row) => (
        <TimeRow
          key={row.key}
          label={row.label}
          description={row.description}
          hourKey={`${row.key}_${session}_hour`}
          minKey={`${row.key}_${session}_min`}
          form={form} setForm={setForm}
        />
      ))}
    </div>
  );
}

export default function DutyTimingSettingsPage({ user }) {
  const toast = useToast();
  const { data: settings, isLoading } = useDutyTimingSettings();
  const updateSettings = useUpdateDutyTimingSettings();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings && !form) {
      const initial = {};
      for (const key of FIELDS) initial[key] = settings[key];
      setForm(initial);
    }
  }, [settings, form]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync(form);
      toast({ message: 'Duty timing settings updated.' });
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed to save settings.', type: 'error' });
    }
  }

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Duty Timing Settings' }]} />
      <PageHeader title="Duty Timing Settings" subtitle="Session start times, late cutoffs, and auto clock-out — per session" />

      {isLoading || !form ? (
        <p className="text-[var(--text-muted)] text-[length:13px]">Loading…</p>
      ) : (
        <div className="max-w-[760px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <SessionSection session="morning" form={form} setForm={setForm} />
            <SessionSection session="afternoon" form={form} setForm={setForm} />
          </div>

          <Button onClick={handleSave} loading={updateSettings.isPending}>
            Save Changes
          </Button>
        </div>
      )}
    </Layout>
  );
}
