import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import simsLogo from '../../assets/sims-logo.png';
import { INSTITUTION_NAME } from '../../utils/branding';
import { ROLES } from '../../utils/constants';
import { useRequestOtp, useVerifyOtp } from '../../hooks/useAuth';

// Plain-language messages for a failed Telegram magic-link login
// (022-telegram-magic-link-login) — see
// specs/022-telegram-magic-link-login/contracts/telegram-login-endpoint.md
const TELEGRAM_ERROR_MESSAGES = {
  expired: 'That Telegram login link has expired. Message the bot /login for a new one.',
  used: 'That Telegram login link has already been used. Message the bot /login for a new one.',
  inactive_account: 'That account is no longer active. Contact your admin.',
  not_found: 'That Telegram login link is invalid. Message the bot /login for a new one.',
};

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  // Step management: 'id' = SIMS ID entry; 'code' = code entry
  const [step, setStep] = useState('id');
  const [simsId, setSimsId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const telegramErrorCode = searchParams.get('telegram_error');
  const telegramError = telegramErrorCode
    ? TELEGRAM_ERROR_MESSAGES[telegramErrorCode] || TELEGRAM_ERROR_MESSAGES.not_found
    : null;

  // ─── Step 1: Request OTP code ───────────────────────────────────────────
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');

    if (!simsId.trim()) {
      setError('Please enter your SIMS ID.');
      return;
    }

    setIsLoading(true);
    try {
      await requestOtp.mutateAsync({ sims_id: simsId });
      // On success, advance to Step 2 (code entry)
      setStep('code');
      setCode('');
    } catch (err) {
      if (!err.response) {
        setError("Can't reach the server. Check your connection and try again.");
      } else if (err.response.status === 429) {
        setError('Too many requests. Please wait and try again.');
      } else {
        setError(err.response.data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify OTP code ───────────────────────────────────────────
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('Please enter the code from Telegram.');
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError('Code must be 6 digits.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOtp.mutateAsync({ sims_id: simsId, code });
      const userData = res.data;

      if (userData.must_change_password) {
        navigate('/change-password', { replace: true });
      } else if (!userData.role) {
        setError('Login failed: No role information received.');
      } else {
        const role = userData.role?.toLowerCase() || '';
        if (role === ROLES.FACULTY) {
          navigate('/faculty/dashboard', { replace: true });
        } else {
          navigate('/admin/dashboard', { replace: true });
        }
      }
    } catch (err) {
      if (!err.response) {
        setError("Can't reach the server. Check your connection and try again.");
      } else if (err.response.status === 401) {
        setError('Invalid code. Please try again or request a new code.');
      } else if (err.response.status === 429) {
        setError('Too many attempts. Please wait and try again.');
      } else {
        setError(err.response.data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setStep('id');
    setCode('');
    setError('');
  };

  const inputClasses = [
    'border-2 border-[var(--border)] rounded-[var(--radius-xl)] px-5 sm:px-4 h-14 sm:h-11',
    'text-[var(--text-primary)]',
    'outline-none w-full bg-[var(--surface-page)]',
    'transition-[border-color,box-shadow] duration-[var(--dur-fast)]',
    'focus:border-[var(--border-strong)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]',
    isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-auto',
  ].join(' ');

  return (
    <div className="min-h-dvh w-full flex flex-col items-center sm:justify-center bg-[var(--surface-sidebar)] relative overflow-hidden">

      {/* ── Background glow circles ── */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: -80, right: -80, width: 260, height: 260,
          background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)',
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          bottom: 200, left: -60, width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)',
        }}
      />

      {/* ── Centered container ── */}
      <div className="w-full max-w-[440px] flex flex-col flex-1 sm:flex-none">

        {/* ── Top branding area ── */}
        <div className="flex-none flex flex-col items-center justify-center pt-12 sm:pt-6 pb-8 sm:pb-4 px-6 text-center">
          <img
            src={simsLogo}
            alt={INSTITUTION_NAME}
            className="w-20 h-20 sm:w-14 sm:h-14 object-contain mb-4 sm:mb-3"
          />

          <p className="text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--color-blue-500)] uppercase tracking-[var(--tracking-caps)] mb-2 sm:mb-1">
            {INSTITUTION_NAME}
          </p>

          <h1 className="text-[length:var(--text-display)] sm:text-[22px] font-[var(--weight-extra)] text-[var(--text-on-dark)] leading-[var(--leading-tight)] mb-2 sm:mb-1">
            Discipline<br />Management System
          </h1>

          <p className="text-[length:var(--text-body)] sm:text-[13px] text-[var(--text-secondary)] leading-[var(--leading-normal)] max-w-[280px]">
            Faculty duty scheduling and student violation tracking
          </p>
        </div>

        {/* ── Form card ── */}
        <div
          className="flex-1 sm:flex-none bg-[var(--surface-card)] rounded-t-[var(--radius-sheet)] sm:rounded-[var(--radius-sheet)] px-8 pt-10 sm:pt-6 pb-10 sm:pb-6 sm:mb-4"
          style={{ boxShadow: 'var(--shadow-sheet)' }}
        >
          <form onSubmit={step === 'id' ? handleRequestCode : handleVerifyCode} className="flex flex-col gap-5 sm:gap-3">

            {/* ─── STEP 1: SIMS ID Entry ─── */}
            {step === 'id' && (
              <>
                <div className="mb-1">
                  <h2 className="text-[length:var(--text-h2)] sm:text-[18px] font-[var(--weight-extra)] text-[var(--text-primary)] mb-1">
                    Sign in
                  </h2>
                  <p className="text-[length:var(--text-body)] sm:text-[12px] text-[var(--text-secondary)]">
                    Enter your four-digit SIMS ID to continue
                  </p>
                </div>

                {/* Telegram magic-link error banner */}
                {telegramError && (
                  <div
                    className="rounded-[var(--radius-lg)] px-3.5 py-3 sm:py-2 text-[length:var(--text-card)] sm:text-[12px] text-[var(--color-red-text)]"
                    style={{
                      backgroundColor: 'var(--color-red-bg)',
                      border: '1px solid var(--color-red-border)',
                      borderLeft: '3px solid var(--color-red-solid)',
                    }}
                  >
                    {telegramError}
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div
                    className="rounded-[var(--radius-lg)] px-3.5 py-3 sm:py-2 text-[length:var(--text-card)] sm:text-[12px] text-[var(--color-red-text)]"
                    style={{
                      backgroundColor: 'var(--color-red-bg)',
                      border: '1px solid var(--color-red-border)',
                      borderLeft: '3px solid var(--color-red-solid)',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* SIMS ID field */}
                <div className="flex flex-col gap-2 sm:gap-1">
                  <label
                    htmlFor="login-sims-id"
                    className="text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--text-secondary)] uppercase tracking-[var(--tracking-label)] pl-5"
                  >
                    SIMS ID
                  </label>
                  <input
                    id="login-sims-id"
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    placeholder="e.g. 1100"
                    value={simsId}
                    onChange={(e) => setSimsId(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    autoFocus
                    disabled={isLoading}
                    style={{ fontSize: 16 }}
                    className={inputClasses}
                  />
                </div>

                {/* Request Code CTA */}
                <button
                  type="submit"
                  disabled={isLoading || !simsId.trim()}
                  className={[
                    'w-full h-14 sm:h-11 rounded-[var(--radius-xl)] border-none',
                    'text-[length:var(--text-card-lg)] font-[var(--weight-bold)] font-[var(--font-sans)]',
                    'text-[var(--text-on-brand)]',
                    'transition-all duration-[var(--dur-fast)]',
                    (isLoading || !simsId.trim()) ? 'bg-[var(--color-blue-300)] cursor-not-allowed shadow-none' : 'cursor-pointer active:scale-[0.97] active:opacity-90',
                  ].join(' ')}
                  style={
                    (isLoading || !simsId.trim())
                      ? undefined
                      : {
                          background: 'var(--brand-gradient-deep)',
                          boxShadow: 'var(--shadow-brand)',
                        }
                  }
                >
                  {isLoading ? 'Sending code...' : 'Send Code'}
                </button>

                {/* Telegram magic-link login entry point (022-telegram-magic-link-login) */}
                {TELEGRAM_BOT_USERNAME && (
                  <a
                    href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=login`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-12 sm:h-10 rounded-[var(--radius-xl)] flex items-center justify-center gap-2 text-[length:var(--text-card)] font-[var(--weight-bold)] text-[var(--text-secondary)] border-2 border-[var(--border)] hover:border-[var(--border-strong)] transition-colors"
                  >
                    Log in via Telegram
                  </a>
                )}
              </>
            )}

            {/* ─── STEP 2: Code Entry ─── */}
            {step === 'code' && (
              <>
                <div className="mb-1">
                  <h2 className="text-[length:var(--text-h2)] sm:text-[18px] font-[var(--weight-extra)] text-[var(--text-primary)] mb-1">
                    Enter your code
                  </h2>
                  <p className="text-[length:var(--text-body)] sm:text-[12px] text-[var(--text-secondary)]">
                    We sent a 6-digit code to your Telegram
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div
                    className="rounded-[var(--radius-lg)] px-3.5 py-3 sm:py-2 text-[length:var(--text-card)] sm:text-[12px] text-[var(--color-red-text)]"
                    style={{
                      backgroundColor: 'var(--color-red-bg)',
                      border: '1px solid var(--color-red-border)',
                      borderLeft: '3px solid var(--color-red-solid)',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* 6-digit code field */}
                <div className="flex flex-col gap-2 sm:gap-1">
                  <label
                    htmlFor="login-code"
                    className="text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--text-secondary)] uppercase tracking-[var(--tracking-label)] pl-5"
                  >
                    Code
                  </label>
                  <input
                    id="login-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    disabled={isLoading}
                    style={{ fontSize: 16 }}
                    className={inputClasses}
                  />
                </div>

                {/* Verify Code CTA */}
                <button
                  type="submit"
                  disabled={isLoading || !/^\d{6}$/.test(code)}
                  className={[
                    'w-full h-14 sm:h-11 rounded-[var(--radius-xl)] border-none',
                    'text-[length:var(--text-card-lg)] font-[var(--weight-bold)] font-[var(--font-sans)]',
                    'text-[var(--text-on-brand)]',
                    'transition-all duration-[var(--dur-fast)]',
                    (isLoading || !/^\d{6}$/.test(code)) ? 'bg-[var(--color-blue-300)] cursor-not-allowed shadow-none' : 'cursor-pointer active:scale-[0.97] active:opacity-90',
                  ].join(' ')}
                  style={
                    (isLoading || !/^\d{6}$/.test(code))
                      ? undefined
                      : {
                          background: 'var(--brand-gradient-deep)',
                          boxShadow: 'var(--shadow-brand)',
                        }
                  }
                >
                  {isLoading ? 'Verifying...' : 'Sign in'}
                </button>

                {/* Back to SIMS ID entry */}
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isLoading}
                  className="w-full h-12 sm:h-10 rounded-[var(--radius-xl)] flex items-center justify-center text-[length:var(--text-card)] font-[var(--weight-bold)] text-[var(--text-secondary)] border-2 border-[var(--border)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              </>
            )}

            {/* Password login fallback link (visible on Step 1 only) */}
            {step === 'id' && (
              <div className="pt-2 sm:pt-1 text-center">
                <p className="text-[length:var(--text-body)] sm:text-[12px] text-[var(--text-secondary)] mb-2">
                  Having trouble with Telegram?
                </p>
                <a
                  href="/login/password"
                  className="text-[length:var(--text-body)] sm:text-[12px] font-[var(--weight-bold)] text-[var(--color-blue-500)] hover:text-[var(--color-blue-600)] transition-colors"
                >
                  Log in with your password instead
                </a>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
