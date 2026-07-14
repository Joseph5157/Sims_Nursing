import { useState, useRef, useEffect } from 'react';
import Layout from '../../components/Layout';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import { Button } from '@mantine/core';
import { useToast } from '../../components/ui/Toast';
import { useAvailableSlots, useMonthSlots, usePickSlot } from '../../hooks/useDutySlots';
import { useDutyTimingSettings } from '../../hooks/useDutyTimingSettings';
import { formatHourMin } from '../../utils/time';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const DAY_LABELS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function localDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export default function SlotPickerPage({ user }) {
  const toast = useToast();
  const now   = new Date();
  const todayStr = localDateStr(now);

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState(null); // dateStr of tapped cell
  const [pickingId, setPickingId] = useState(null);
  const panelRef = useRef(null);

  // When a date is selected, scroll its session panel into view so the
  // Pick buttons clear the fixed bottom nav bar.
  useEffect(() => {
    if (selected && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selected]);

  const { data: available, isLoading: loadingAvail } = useAvailableSlots(year, month);
  const { data: mySlots,   isLoading: loadingMine }  = useMonthSlots(year, month);
  const { data: timingSettings } = useDutyTimingSettings();

  const morningStartLabel = timingSettings
    ? formatHourMin(timingSettings.session_start_morning_hour, timingSettings.session_start_morning_min)
    : '8:00 AM';
  const afternoonStartLabel = timingSettings
    ? formatHourMin(timingSettings.session_start_afternoon_hour, timingSettings.session_start_afternoon_min)
    : '1:00 PM';

  const pick = usePickSlot();

  async function handlePick(dateStr, session) {
    const key = `${dateStr}|${session}`;
    setPickingId(key);
    try {
      await pick.mutateAsync({ duty_date: dateStr, session_type: session });
      toast({ message: `✅ ${session === 'morning' ? 'Morning' : 'Afternoon'} on ${dateStr} picked!` });
      setSelected(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    } finally {
      setPickingId(null);
    }
  }

  // ── Build lookup maps ──────────────────────────────────────────────────────
  const availMap = {}; // dateStr → ['morning','afternoon']
  for (const s of available?.data ?? []) {
    if (!availMap[s.duty_date]) availMap[s.duty_date] = [];
    availMap[s.duty_date].push(s.session_type);
  }

  const pickedMap = {}; // dateStr → {morning?: slot, afternoon?: slot}
  for (const s of mySlots?.data ?? []) {
    const key = String(s.duty_date).slice(0, 10);
    if (!pickedMap[key]) pickedMap[key] = {};
    pickedMap[key][s.session_type] = s;
  }

  const windowOpen     = !!available && !available?.error;
  const pickedCount    = mySlots?.data?.length ?? 0;
  const remainingSlots = available?.slots_remaining ?? 0;
  const requiredSlots  = available?.sessions_per_faculty ?? 3;

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const firstWeekday  = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth   = new Date(year, month, 0).getDate();

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout user={user}>
      <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 10, marginBottom: 12, borderBottom: '1px solid var(--border-strong)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>My Duty Slots</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Pick your duty slots for the month</p>
      </div>

      {/* ── Window status ── */}
      {loadingAvail ? (
        <Skeleton height="44px" className="rounded-xl mb-4" />
      ) : windowOpen ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--color-emerald-bg)', border: '1px solid var(--color-emerald-border)',
          borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 16,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 'var(--radius-full)', background: 'var(--color-emerald-solid)', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'var(--color-emerald-text)', margin: 0 }}>
            Window <strong>open</strong> ·{' '}
            {loadingMine
              ? <Skeleton width="80px" height="12px" className="inline-block" />
              : <>{pickedCount} of {requiredSlots} picked · <strong>{remainingSlots} left to pick</strong></>}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--surface-page)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 16,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 'var(--radius-full)', background: 'var(--text-muted)', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Scheduling window is <strong>closed</strong>.
          </p>
        </div>
      )}

      {/* ── Calendar ── */}
      <div className="md:max-w-[420px]" style={{
        background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)',
        padding: '16px', marginBottom: 20,
      }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={prevMonth} style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'var(--surface-page)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>‹</button>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>
            {MONTH_NAMES[month - 1]} {year}
          </p>
          <button onClick={nextMonth} style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'var(--surface-page)', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>›</button>
        </div>

        {/* Legend — above grid */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-blue-500)', display: 'inline-block' }} />
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Morning</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-orange-solid)', display: 'inline-block' }} />
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Afternoon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-emerald-solid)', display: 'inline-block' }} />
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Picked</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--color-slate-400)', display: 'inline-block' }} />
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Past</span>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {DAY_LABELS.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Loading state */}
        {(loadingAvail || loadingMine) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} height="40px" className="rounded-lg" />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;

              const isPast       = dateStr < todayStr;
              const isToday      = dateStr === todayStr;
              const avail        = availMap[dateStr] ?? [];
              const picked       = pickedMap[dateStr] ?? {};
              const hasMorn      = avail.includes('morning');
              const hasAftern    = avail.includes('afternoon');
              const pickedMorn   = !!picked.morning;
              const pickedAftern = !!picked.afternoon;
              const isPastPicked = isPast && (pickedMorn || pickedAftern);
              const isSelected   = selected === dateStr;
              const hasAnything  = avail.length > 0 || pickedMorn || pickedAftern;
              const isClickable  = !isPast && hasAnything && windowOpen;

              const d = parseInt(dateStr.slice(8), 10);

              let bg = 'transparent', border = 'none', color = 'var(--text-muted)';
              if (isToday)      { border = '2px solid var(--brand)'; color = 'var(--brand)'; }
              if (isPast)       { color = 'var(--text-muted)'; }
              if (isPastPicked) { bg = 'var(--surface-page)'; color = 'var(--text-muted)'; }
              if (isSelected)   { bg = 'var(--color-blue-50)'; border = '2px solid var(--brand)'; }
              if (!isPast && (pickedMorn || pickedAftern)) { color = 'var(--text-primary)'; }

              // Build accessible label
              const dateObj = new Date(year, month - 1, d);
              const fullDateLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              const stateLabel = isPast ? 'past' : (pickedMorn || pickedAftern) ? 'picked' : hasAnything ? 'available' : 'no sessions';
              const ariaLabel = `${fullDateLabel} — ${stateLabel}`;

              return (
                <button
                  key={i}
                  onClick={() => isClickable && setSelected(isSelected ? null : dateStr)}
                  disabled={!isClickable}
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  aria-disabled={!isClickable}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-md)',
                    border: border || '1px solid transparent',
                    background: bg, cursor: isClickable ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 2, gap: 2,
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                    transition: 'transform 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color, lineHeight: 1 }}>
                    {d}
                  </span>
                  {/* Session dots */}
                  <div style={{ display: 'flex', gap: 3, minHeight: 8 }}>
                    {(hasMorn || pickedMorn) && (
                      <span style={{
                        width: 8, height: 8, borderRadius: 'var(--radius-full)',
                        background: pickedMorn ? (isPast ? 'var(--color-slate-400)' : 'var(--color-emerald-solid)') : 'var(--color-blue-500)',
                        flexShrink: 0,
                      }} />
                    )}
                    {(hasAftern || pickedAftern) && (
                      <span style={{
                        width: 8, height: 8, borderRadius: 'var(--radius-full)',
                        background: pickedAftern ? (isPast ? 'var(--color-slate-400)' : 'var(--color-emerald-solid)') : 'var(--color-orange-solid)',
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Selected-date session picker panel ── */}
        {selected && (() => {
          const avail        = availMap[selected] ?? [];
          const picked       = pickedMap[selected] ?? {};
          const hasMorn      = avail.includes('morning');
          const hasAftern    = avail.includes('afternoon');
          const pickedMorn   = !!picked.morning;
          const pickedAftern = !!picked.afternoon;
          const d            = new Date(selected);

          return (
            <div ref={panelRef} style={{
              marginTop: 14, padding: 14,
              background: 'var(--surface-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
              scrollMarginTop: 80, scrollMarginBottom: 80,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                {DAY_LABELS_FULL[d.getDay()]}, {d.getDate()} {MONTH_NAMES[d.getMonth()]}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Morning */}
                {pickedMorn ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-emerald-bg)', border: '1px solid var(--color-emerald-border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-emerald-text)', fontWeight: 600 }}>✅ Morning picked</span>
                  </div>
                ) : hasMorn ? (
                  <Button
                    size="md" fullWidth
                    loading={pickingId === `${selected}|morning`}
                    disabled={!!pickingId && pickingId !== `${selected}|morning`}
                    onClick={() => handlePick(selected, 'morning')}
                    leftSection={<span style={{ fontSize: 11, background: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>AM</span>}
                  >
                    Pick Morning ({morningStartLabel})
                  </Button>
                ) : null}

                {/* Afternoon */}
                {pickedAftern ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-emerald-bg)', border: '1px solid var(--color-emerald-border)', borderRadius: 'var(--radius-lg)', padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-emerald-text)', fontWeight: 600 }}>✅ Afternoon picked</span>
                  </div>
                ) : hasAftern ? (
                  <Button
                    size="md" fullWidth variant="default"
                    loading={pickingId === `${selected}|afternoon`}
                    disabled={!!pickingId && pickingId !== `${selected}|afternoon`}
                    onClick={() => handlePick(selected, 'afternoon')}
                    style={{ background: 'var(--color-orange-bg)', color: 'var(--color-orange-solid)', border: '1px solid var(--color-orange-border)' }}
                    leftSection={<span style={{ fontSize: 11, background: 'var(--color-orange-border)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>PM</span>}
                  >
                    Pick Afternoon ({afternoonStartLabel})
                  </Button>
                ) : null}

                {remainingSlots <= 0 && !pickedMorn && !pickedAftern && (
                  <p style={{ fontSize: 12, color: 'var(--color-amber-text)', margin: 0, textAlign: 'center' }}>
                    You've reached your {requiredSlots}-slot limit. To change a picked slot, ask your Admin to reassign it, or request a reassignment from a colleague.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* No slots message when window is open but empty */}
        {windowOpen && !loadingAvail && (available?.data ?? []).length === 0 && (
          <div style={{
            marginTop: 16, padding: '12px 14px',
            background: 'var(--color-amber-bg)', border: '1px solid var(--color-amber-border)', borderRadius: 'var(--radius-lg)',
          }}>
            <p style={{ fontSize: 12, color: 'var(--color-amber-text)', margin: 0 }}>
              ⚠️ No slots set up for this month yet. Ask your Admin to configure working days on the Duty Calendar page.
            </p>
          </div>
        )}
      </div>

      {/* ── My Picks summary ── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          My picks · {pickedCount} / {requiredSlots} required
        </p>
        {loadingMine ? (
          <Skeleton height="52px" className="rounded-xl" />
        ) : !mySlots?.data?.length ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            Tap a highlighted date above to pick your slots.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mySlots.data.map((s) => {
              const key = String(s.duty_date).slice(0, 10);
              const d = new Date(key);
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                  padding: '10px 14px',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 'var(--radius-full)', flexShrink: 0,
                    background: s.session_type === 'morning' ? 'var(--color-blue-500)' : 'var(--color-orange-solid)',
                  }} />
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, textTransform: 'capitalize' }}>
                    {s.session_type} · {d.getDate()} {MONTH_NAMES[d.getMonth()].slice(0,3)}
                  </p>
                  <Badge status={s.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
