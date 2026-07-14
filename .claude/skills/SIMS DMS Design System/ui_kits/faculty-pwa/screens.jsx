/* ───────────────────────────────────────────────────────────────
   Faculty PWA UI kit — screens
   Composes DS components (Button, Badge, StatCard, Alert, …) with
   the phone shell. Recreates: Login (OTP), Dashboard, Slots,
   Attendance check-in/out, Violation recorder, Messages.
   ─────────────────────────────────────────────────────────────── */
const { useState } = React;
const DS = window.SIMSDMSDesignSystem_019e12;
const { Button, Badge, StatCard, Alert, Input, BrandMark, MobileCard, SectionHeader, EmptyState } = DS;

// ── LOGIN ───────────────────────────────────────────────────────
function LoginScreen({ onAuth }) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('priya.sharma@sims.edu');
  const [otp, setOtp] = useState('');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--slate-900)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)' }} />
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px 28px' }}>
        <div style={{ marginBottom: 18 }}><BrandMark size="lg" glow /></div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--blue-500)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>SIMS College of Pharmacy</p>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, color: '#f8fafc', lineHeight: 1.25, marginBottom: 12 }}>Discipline Management System</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--slate-500)', maxWidth: 260 }}>Faculty duty scheduling and student violation tracking</p>
      </div>
      <div style={{ flex: 1, background: '#fff', borderRadius: '28px 28px 0 0', padding: '26px 24px', boxShadow: 'var(--shadow-sheet)' }}>
        <div style={{ width: 40, height: 4, background: 'var(--slate-200)', borderRadius: 2, margin: '0 auto 22px' }} />
        {step === 'request' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Sign in</h2>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>Enter your email address to receive your OTP</p>
            </div>
            <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Alert tone="info" icon="✈️">OTP sent via <strong>@SIMSDMSBOT</strong> Telegram bot. Make sure you have started the bot.</Alert>
            <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => setStep('verify')}>Send OTP →</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Enter OTP</h2>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>Check your Telegram for a 6-digit code</p>
            </div>
            <OtpBoxes value={otp} onChange={setOtp} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Expires in <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--slate-500)' }}>04:52</span></span>
              <button style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Resend OTP</button>
            </div>
            <Button variant="primary" size="lg" style={{ width: '100%' }} disabled={otp.length < 6} onClick={onAuth}>Verify &amp; Sign in →</Button>
            <button onClick={() => setStep('request')} style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>← Use a different email</button>
          </div>
        )}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--slate-300)', marginTop: 26 }}>SIMS DMS · Version 1.0</p>
      </div>
    </div>
  );
}

function OtpBoxes({ value, onChange }) {
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input key={i} inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, '').slice(-1);
            const arr = digits.slice(); arr[i] = c; onChange(arr.join('').slice(0, 6));
            if (c && e.target.nextSibling) e.target.nextSibling.focus();
          }}
          style={{ width: 44, height: 52, textAlign: 'center', fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, border: '1px solid var(--slate-200)', borderRadius: 10, outline: 'none', color: 'var(--text-primary)' }} />
      ))}
    </div>
  );
}

// ── DASHBOARD ───────────────────────────────────────────────────
function DashboardScreen({ go }) {
  const unread = MOCK.messages.filter((m) => !m.read).length;
  return (
    <PageBody header={<MobilePageHeader title="Welcome, Priya" subtitle="Thursday, 13 March 2025" />}>
      <div style={{ marginTop: 12, borderRadius: 16, padding: 16, background: 'linear-gradient(135deg, #eff6ff, #eef2ff)', border: '1px solid var(--blue-200)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--blue-800)' }}>You have duty today</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--blue-500)', textTransform: 'capitalize' }}>Morning session</p>
          </div>
          <Badge status="scheduled" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" icon={<span>📋</span>} onClick={() => go('attendance')}>Check In / Out</Button>
          <Button variant="secondary" icon={<span>⚠️</span>} onClick={() => go('violations')}>Record Violation</Button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Alert tone="warning" icon="🔄" title="1 open cover request — awaiting a volunteer" action={<Button variant="outline" size="sm" onClick={() => go('slots')}>View →</Button>} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        <StatCard label="Slots" value={4} accent="blue" icon="🗓" />
        <StatCard label="Logged" value={7} accent="default" icon="⚠️" />
        <StatCard label="Unread" value={unread} accent={unread ? 'yellow' : 'default'} icon="✉️" />
      </div>

      <SectionHeader title="Upcoming duties" />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {MOCK.upcoming.map((s) => (
          <MobileCard key={s.id} primary={`${s.date} · ${s.session}`} badge={<Badge status={s.status} />} showChevron={false} />
        ))}
      </div>

      <SectionHeader title="Recent messages" action={<span style={{ fontSize: 10, background: 'var(--blue-100)', color: 'var(--blue-600)', borderRadius: 8, padding: '2px 6px', fontWeight: 700 }}>{unread} unread</span>} />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {MOCK.messages.map((m) => (
          <MobileCard key={m.id} primary={m.subject} secondary={m.read ? 'Read' : 'New'} onClick={() => go('messages')}
            badge={!m.read ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-500)' }} /> : null} showChevron={false} />
        ))}
      </div>
    </PageBody>
  );
}

// ── SLOTS ───────────────────────────────────────────────────────
function SlotsScreen() {
  return (
    <PageBody header={<MobilePageHeader title="My Slots" subtitle="March 2025 · 4 of 4 picked" />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <StatCard label="Picked" value={4} accent="blue" />
        <StatCard label="Required" value={4} accent="green" sub="Complete" />
      </div>
      <SectionHeader title="This month" />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <MobileCard primary="13 Mar · Morning" secondary="Today" badge={<Badge status="scheduled" />} showChevron={false} />
        {MOCK.upcoming.map((s) => (
          <MobileCard key={s.id} primary={`${s.date} · ${s.session}`}
            badge={<Badge status={s.status} />}
            action={s.status === 'cover_pending' ? <Button variant="outline" size="xs">Cover</Button> : null} showChevron={false} />
        ))}
      </div>
      <SectionHeader title="Need a swap?" />
      <Alert tone="info" icon="🔄" title="Request cover for a slot">Broadcast to all faculty — a volunteer picks it up, an admin confirms.</Alert>
    </PageBody>
  );
}

// ── ATTENDANCE ──────────────────────────────────────────────────
function AttendanceScreen() {
  const [state, setState] = useState('out'); // out → in → done
  return (
    <PageBody header={<MobilePageHeader title="Attendance" subtitle="Morning session · 13 March" />}>
      <div style={{ marginTop: 16, background: '#fff', borderRadius: 16, border: '1px solid var(--border)', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>{state === 'done' ? '✅' : '🕘'}</div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {state === 'out' ? 'Not checked in' : state === 'in' ? 'Checked in' : 'Duty complete'}
        </p>
        <p style={{ margin: '4px 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          {state === 'out' ? 'Window: 9:00 – 9:15 AM' : state === 'in' ? 'In at 9:08 AM · On time' : 'In 9:08 · Out 1:02 PM'}
        </p>
        {state === 'out' && <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => setState('in')}>Check In</Button>}
        {state === 'in' && <Button variant="success" size="lg" style={{ width: '100%' }} onClick={() => setState('done')}>Check Out</Button>}
        {state === 'done' && <Badge status="completed" />}
      </div>
      {state === 'in' && <div style={{ marginTop: 12 }}><Alert tone="success" icon="✅" title="Checked in on time">Auto check-out runs at 4:30 PM if you forget.</Alert></div>}
      <SectionHeader title="This week" />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <MobileCard primary="11 Mar · Morning" secondary="In 9:05 · Out 1:00" badge={<Badge status="completed" />} showChevron={false} />
        <MobileCard primary="07 Mar · Afternoon" secondary="In 1:22 · Late" badge={<Badge status="late" />} showChevron={false} />
      </div>
    </PageBody>
  );
}

// ── VIOLATIONS (recorder) ───────────────────────────────────────
function ViolationsScreen() {
  const [student, setStudent] = useState(null);
  const [type, setType] = useState(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <PageBody header={<MobilePageHeader title="Record Violation" />}>
        <div style={{ marginTop: 20 }}>
          <EmptyState emoji="✅" title="Violation recorded"
            subtitle={`${student.name} · ${type.name}${type.fine ? ` · ₹${type.fine} fine` : ''}`}
            action={<Button variant="secondary" onClick={() => { setDone(false); setStudent(null); setType(null); }}>Record another</Button>} />
        </div>
      </PageBody>
    );
  }

  return (
    <PageBody header={<MobilePageHeader title="Record Violation" subtitle="Morning session · 13 March" />}>
      <SectionHeader title="1 · Select student" />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {MOCK.students.map((s) => (
          <MobileCard key={s.id} primary={s.name} secondary={`${s.reg} · ${s.course}`}
            onClick={() => setStudent(s)}
            badge={student?.id === s.id ? <Badge status="checked_in" label="Selected" /> : null} showChevron={student?.id !== s.id} />
        ))}
      </div>

      {student && (
        <>
          <SectionHeader title="2 · Violation type" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MOCK.violationTypes.map((v) => {
              const on = type?.id === v.id;
              return (
                <button key={v.id} onClick={() => setType(v)} style={{
                  border: `1px solid ${on ? 'var(--blue-500)' : 'var(--slate-200)'}`,
                  background: on ? 'var(--blue-50)' : '#fff', color: on ? 'var(--blue-700)' : 'var(--slate-700)',
                  borderRadius: 9999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {v.name}{v.fine ? ` · ₹${v.fine}` : ''}
                </button>
              );
            })}
          </div>
        </>
      )}

      {student && type && (
        <div style={{ marginTop: 18 }}>
          <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => setDone(true)}>
            Log violation{type.fine ? ` · ₹${type.fine} fine` : ' · warning'}
          </Button>
        </div>
      )}
    </PageBody>
  );
}

// ── MESSAGES ────────────────────────────────────────────────────
function MessagesScreen() {
  return (
    <PageBody header={<MobilePageHeader title="Messages" subtitle="2 unread" />}>
      <div style={{ marginTop: 12, background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {MOCK.messages.map((m) => (
          <MobileCard key={m.id} primary={m.subject} secondary={m.read ? 'Admin · Read' : 'Admin · New'}
            onClick={() => {}}
            badge={!m.read ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue-500)' }} /> : null} />
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" icon={<span>✏️</span>} style={{ width: '100%' }}>Compose message</Button>
      </div>
    </PageBody>
  );
}

Object.assign(window, { LoginScreen, DashboardScreen, SlotsScreen, AttendanceScreen, ViolationsScreen, MessagesScreen });
