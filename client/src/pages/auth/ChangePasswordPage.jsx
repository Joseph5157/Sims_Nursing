import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../../hooks/useAuth';
import api from '../../utils/api';
import { INSTITUTION_NAME, APP_SHORT_NAME } from '../../utils/branding';

/* Shared Tailwind class string for password/text inputs */
const fieldClass = (isLoading) => [
  'border-2 border-[var(--border)] rounded-[var(--radius-xl)] px-4 py-3.5',
  'text-[var(--text-primary)]',
  'outline-none w-full bg-[var(--surface-page)]',
  'transition-[border-color] duration-[var(--dur-fast)]',
  'focus:border-[var(--brand)]',
  isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-auto',
].join(' ');

/* Shared Tailwind class string for labels */
const labelClass =
  'text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--text-secondary)] uppercase tracking-[var(--tracking-label)]';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isMandatory = currentUser?.must_change_password ?? false;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      const updatedUser = { ...currentUser, must_change_password: false };
      queryClient.setQueryData(['currentUser'], updatedUser);

      if (currentUser?.role === 'faculty') {
        navigate('/faculty/dashboard', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setIsLoading(false);
      const code = err.response?.data?.code;
      if (code === 'INVALID_CURRENT_PASSWORD') {
        setError('Current password is incorrect.');
      } else {
        setError(err.response?.data?.message ?? 'Failed to change password. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (currentUser?.role === 'faculty') {
      navigate('/faculty/dashboard');
    } else {
      navigate('/admin/dashboard');
    }
  };

  const isSubmitDisabled = isLoading
    || !currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()
    || newPassword.length < 8 || newPassword !== confirmNewPassword;

  return (
    <div className="min-h-dvh w-full flex flex-col bg-[var(--surface-sidebar)] relative overflow-hidden">

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

      {/* ── Top branding area ── */}
      <div className="flex-none flex flex-col items-center justify-center pt-[72px] pb-10 px-6 text-center">
        {/* Brand mark */}
        <div
          className="w-[72px] h-[72px] rounded-[var(--radius-3xl)] flex items-center justify-center text-[length:32px] mb-5"
          style={{
            background: 'var(--brand-gradient)',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          🔐
        </div>

        <p className="text-[length:var(--text-small)] font-[var(--weight-bold)] text-[var(--color-blue-500)] uppercase tracking-[var(--tracking-caps)] mb-2">
          {INSTITUTION_NAME}
        </p>

        <h1 className="text-[length:var(--text-display)] font-[var(--weight-extra)] text-[var(--text-on-dark)] leading-[var(--leading-tight)] mb-2.5">
          Change Password
        </h1>

        <p className="text-[length:var(--text-body)] text-[var(--color-slate-500)] leading-[var(--leading-normal)] max-w-[280px]">
          Secure your account with a new password
        </p>
      </div>

      {/* ── Form sheet ── */}
      <div
        className="flex-1 bg-[var(--surface-card)] rounded-t-[var(--radius-sheet)] px-6 pt-8 pb-12"
        style={{ boxShadow: 'var(--shadow-sheet)' }}
      >
        {/* Pull handle */}
        <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-7" />

        {/* Mandatory change banner */}
        {isMandatory && (
          <div
            className="rounded-[var(--radius-lg)] px-3.5 py-3 mb-5 flex gap-2.5 items-start"
            style={{
              backgroundColor: 'var(--color-amber-bg)',
              border: '1px solid var(--color-amber-border)',
              borderLeft: '3px solid var(--color-amber-solid)',
            }}
          >
            <span className="text-base shrink-0">⚠️</span>
            <p className="text-[length:var(--text-card)] text-[var(--color-amber-text)] leading-[var(--leading-snug)] m-0">
              You must set a new password before continuing to access the system.
            </p>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-5">
          <div>
            <h2 className="text-[length:var(--text-h2)] font-[var(--weight-extra)] text-[var(--text-primary)] mb-1">
              Update your password
            </h2>
            <p className="text-[length:var(--text-body)] text-[var(--text-muted)]">
              Enter your current password and choose a new one
            </p>
          </div>

          {/* Current password */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Current Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={isLoading}
              style={{ fontSize: 16 }}
              className={fieldClass(isLoading)}
            />
          </div>

          {/* New password */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Enter a new password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isLoading}
              style={{ fontSize: 16 }}
              className={fieldClass(isLoading)}
            />
            {newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-[length:var(--text-small)] text-[var(--color-red-solid)] m-0">
                Password must be at least 8 characters
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Confirm New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              disabled={isLoading}
              style={{ fontSize: 16 }}
              className={fieldClass(isLoading)}
            />
            {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
              <p className="text-[length:var(--text-small)] text-[var(--color-red-solid)] m-0">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div
              className="rounded-[var(--radius-lg)] px-3.5 py-3 text-[length:var(--text-card)] text-[var(--color-red-text)]"
              style={{
                backgroundColor: 'var(--color-red-bg)',
                border: '1px solid var(--color-red-border)',
                borderLeft: '3px solid var(--color-red-solid)',
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={[
                'w-full py-4 rounded-[var(--radius-xl)] border-none',
                'text-[length:var(--text-card-lg)] font-[var(--weight-bold)] font-[var(--font-sans)]',
                'text-[var(--text-on-brand)]',
                'transition-all duration-[var(--dur-fast)]',
                isSubmitDisabled
                  ? 'bg-[var(--color-blue-300)] cursor-not-allowed shadow-none'
                  : 'cursor-pointer',
              ].join(' ')}
              style={
                isSubmitDisabled
                  ? undefined
                  : {
                      background: 'var(--brand-gradient-deep)',
                      boxShadow: 'var(--shadow-brand)',
                    }
              }
            >
              {isLoading ? '⏳ Updating…' : 'Update Password →'}
            </button>

            {!isMandatory && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className={[
                  'text-[length:var(--text-card)] text-[var(--text-muted)]',
                  'bg-transparent border-none text-center font-[var(--font-sans)]',
                  isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                ← Cancel
              </button>
            )}
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-[length:var(--text-micro)] text-[var(--text-muted)] mt-8">
          {APP_SHORT_NAME} · Version 1.0
        </p>
      </div>
    </div>
  );
}
