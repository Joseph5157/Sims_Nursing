import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Building2, IdCard, Tag, Mail, KeyRound, ChevronRight } from 'lucide-react';
import BottomDrawer, { DrawerSpinner, cancelBtnStyle, primaryBtnStyle } from './ui/BottomDrawer';
import UserAvatar from './ui/UserAvatar';
import { useUpdateProfile } from '../hooks/useUsers';
import { useToast } from './ui/Toast';
import { AVATAR_OPTIONS } from '../utils/avatars';

function FieldLabel({ label, icon: Icon, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-[5px] text-[length:var(--text-micro)] font-bold text-[color:var(--text-secondary)] uppercase tracking-[0.08em] mb-1.5">
      {Icon && <Icon size={11} strokeWidth={2.5} />}
      {label}
    </label>
  );
}

const inputClassName = 'w-full h-11 px-3.5 rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border)] bg-[var(--surface-page)] text-[color:var(--text-primary)] outline-none box-border transition-[border-color,background-color] duration-150';
const inputInline = { fontSize: 16, fontFamily: 'inherit' };

export default function ProfileDrawer({ open, onClose, user }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState({ name: '', department: '', designation: '', title: '', avatar: null });

  // Seed the form each time the drawer opens with the latest profile data.
  useEffect(() => {
    if (open) {
      setForm({
        name:        user?.name ?? '',
        department:  user?.department ?? '',
        designation: user?.designation ?? '',
        title:       user?.title ?? '',
        avatar:      user?.avatar ?? null,
      });
    }
  }, [open, user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleAvatarSelect(avatarValue) {
    setForm((f) => ({ ...f, avatar: avatarValue }));
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        data: { avatar: avatarValue },
      });
      toast({ message: 'Avatar updated.' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed to update avatar.', type: 'error' });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        data: {
          name:        form.name.trim(),
          department:  form.department.trim() || undefined,
          designation: form.designation.trim() || undefined,
          title:       form.title.trim() || undefined,
          avatar:      form.avatar,
        },
      });
      toast({ message: 'Profile updated successfully' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed to update profile.', type: 'error' });
    }
  }

  function goToChangePassword() {
    onClose();
    navigate('/change-password', { state: { from: location.pathname } });
  }

  const canSave = form.name.trim().length > 0;

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      title="Profile settings"
      subtitle="Update your details and avatar"
      footer={
        <>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            disabled={updateProfile.isPending || !canSave}
            onClick={handleSubmit}
            data-primary=""
            style={primaryBtnStyle(updateProfile.isPending || !canSave)}
          >
            {updateProfile.isPending && <DrawerSpinner />}
            {updateProfile.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-4 px-5 pb-2">

        {/* Avatar picker */}
        <div>
          <FieldLabel label="Avatar" />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {AVATAR_OPTIONS.map((opt) => {
              const selected = form.avatar === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAvatarSelect(opt.value)}
                  disabled={updateProfile.isPending}
                  aria-pressed={selected}
                  aria-label={opt.label}
                  title={opt.label}
                  className="flex flex-col items-center gap-1 py-2 rounded-[var(--radius-lg)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    border: selected ? '2px solid var(--brand)' : '2px solid var(--border)',
                    background: selected ? 'var(--color-blue-50)' : 'var(--surface-page)',
                  }}
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: opt.gradient }}>
                    <opt.Icon size={18} stroke={2} />
                  </span>
                  <span className="text-[length:10px] font-semibold text-center leading-tight text-[color:var(--text-secondary)]">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live preview — mirrors everything Save will persist: avatar, title + name, department/designation */}
        <div className="flex items-center gap-3 -mt-1">
          <UserAvatar user={{ name: form.name, avatar: form.avatar }} size={40} />
          <div className="min-w-0">
            <p className="text-[length:var(--text-card)] font-semibold text-[color:var(--text-primary)] truncate">
              {form.title ? `${form.title} ` : ''}{form.name || 'Your name'}
            </p>
            <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] truncate">
              {[form.designation, form.department].filter(Boolean).join(' · ') || 'Preview'}
            </p>
          </div>
        </div>

        <div>
          <FieldLabel label="Name" icon={User} htmlFor="profile-name" />
          <input id="profile-name" value={form.name} onChange={set('name')} required className={inputClassName} style={inputInline} />
        </div>

        <div>
          <FieldLabel label="Department" icon={Building2} htmlFor="profile-department" />
          <input id="profile-department" value={form.department} onChange={set('department')} className={inputClassName} style={inputInline} />
        </div>

        <div>
          <FieldLabel label="Designation" icon={IdCard} htmlFor="profile-designation" />
          <input id="profile-designation" value={form.designation} onChange={set('designation')} className={inputClassName} style={inputInline} />
        </div>

        <div>
          <FieldLabel label="Title" icon={Tag} htmlFor="profile-title" />
          <input id="profile-title" value={form.title} onChange={set('title')} placeholder="Dr. / Prof. / Mr." className={inputClassName} style={inputInline} />
          <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] mt-1">Shown in your dashboard greeting.</p>
        </div>

        <div>
          <FieldLabel label="SIMS ID" icon={IdCard} htmlFor="profile-sims-id" />
          <input id="profile-sims-id" value={user?.sims_id ?? ''} disabled className={`${inputClassName} opacity-60 cursor-not-allowed font-mono font-bold`} style={inputInline} />
          <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] mt-1">Your permanent institutional login ID.</p>
        </div>

        <div>
          <FieldLabel label="Email" icon={Mail} htmlFor="profile-email" />
          <input id="profile-email" value={user?.email ?? ''} disabled className={`${inputClassName} opacity-60 cursor-not-allowed`} style={inputInline} />
          <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] mt-1">Managed by administrators.</p>
        </div>

        <button
          type="button"
          onClick={goToChangePassword}
          className="flex items-center justify-between h-11 px-3.5 rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border)] bg-[var(--surface-page)] cursor-pointer"
        >
          <span className="flex items-center gap-[7px] text-[length:var(--text-card)] font-semibold text-[color:var(--text-primary)]">
            <KeyRound size={15} strokeWidth={2} /> Change password
          </span>
          <ChevronRight size={16} className="text-[color:var(--text-muted)]" />
        </button>

      </form>
    </BottomDrawer>
  );
}
