import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuth';
import { ROLES } from '../../utils/constants';
import simsLogo from '../../assets/sims-logo.png';
import { INSTITUTION_NAME } from '../../utils/branding';

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
  const login = useLogin();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const telegramErrorCode = searchParams.get('telegram_error');
  const telegramError = telegramErrorCode
    ? TELEGRAM_ERROR_MESSAGES[telegramErrorCode] || TELEGRAM_ERROR_MESSAGES.not_found
    : null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      const res = await login.mutateAsync({
        email: email.trim(),
        password,
      });

      // Extract data from axios response
      const userData = res.data || res;

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
        setError('Invalid email or password. Please try again.');
      } else if (err.response.status === 429) {
        setError('Too many login attempts. Please wait and try again.');
      } else {
        // 5xx / unexpected — show the server's message so real outages aren't
        // mislabeled as wrong credentials.
        setError(err.response.data?.message || 'Something went wrong. Please try again.');
      }
    }
  };

  const isDisabled = login.isPending || !email.trim() || !password.trim();

  const inputClasses = [
    'border-2 border-[var(--border)] rounded-[var(--radius-xl)] px-5 sm:px-4 h-14 sm:h-11',
    'text-[var(--text-primary)]',
    'outline-none w-full bg-[var(--surface-page)]',
    'transition-[border-color,box-shadow] duration-[var(--dur-fast)]',
    'focus:border-[var(--border-strong)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]',
    login.isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-auto',
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

      {/* ── Centered container (max-width for desktop) ── */}
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
          <form onSubmit={handleLogin} className="flex flex-col gap-5 sm:gap-3">
            <div className="mb-1">
              <h2 className="text-[length:var(--text-h2)] sm:text-[18px] font-[var(--weight-extra)] text-[var(--text-primary)] mb-1">
                Sign in
              </h2>
              <p className="text-[length:var(--text-body)] sm:text-[12px] text-[var(--text-secondary)]">
                Enter your credentials to continue
              </p>
            </div>

            {/* Telegram magic-link error banner (redirected back from a failed /auth/telegram/:token) */}
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

            {/* Email field */}
            <div className="flex flex-col gap-2 sm:gap-1">
              <label
                htmlFor="login-email"
                className="text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--text-secondary)] uppercase tracking-[var(--tracking-label)] pl-5"
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="your.email@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={login.isPending}
                style={{ fontSize: 16 }}
                className={inputClasses}
              />
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-2 sm:gap-1">
              <label
                htmlFor="login-password"
                className="text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--text-secondary)] uppercase tracking-[var(--tracking-label)] pl-5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={login.isPending}
                  style={{ fontSize: 16 }}
                  className={inputClasses + ' pr-14'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors w-11 h-11 flex items-center justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
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

            {/* Sign in CTA */}
            <button
              type="submit"
              disabled={isDisabled}
              className={[
                'w-full h-14 sm:h-11 rounded-[var(--radius-xl)] border-none',
                'text-[length:var(--text-card-lg)] font-[var(--weight-bold)] font-[var(--font-sans)]',
                'text-[var(--text-on-brand)]',
                'transition-all duration-[var(--dur-fast)]',
                isDisabled ? 'bg-[var(--color-blue-300)] cursor-not-allowed shadow-none' : 'cursor-pointer active:scale-[0.97] active:opacity-90',
              ].join(' ')}
              style={
                isDisabled
                  ? undefined
                  : {
                      background: 'var(--brand-gradient-deep)',
                      boxShadow: 'var(--shadow-brand)',
                    }
              }
            >
              {login.isPending ? 'Signing in...' : 'Sign in'}
            </button>

            {/* Telegram magic-link login entry point (022-telegram-magic-link-login) —
                only shown if a bot username is configured; opens Telegram directly to
                the bot with the login request pre-filled, no server call needed here. */}
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
          </form>
        </div>
      </div>
    </div>
  );
}
