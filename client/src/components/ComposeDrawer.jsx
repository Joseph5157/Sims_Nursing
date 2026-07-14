import { useState, useEffect } from 'react';
import { Users, AlignLeft, MessageSquare } from 'lucide-react';
import BottomDrawer, { DrawerSpinner, cancelBtnStyle, primaryBtnStyle } from './ui/BottomDrawer';
import { useSendMessage } from '../hooks/useMessages';
import { useMessageRecipients } from '../hooks/useUsers';
import { useToast } from './ui/Toast';

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

const selectClassName = `${inputClassName} appearance-none pr-9 pl-3.5`;

const selectInline = {
  fontSize: 16, fontFamily: 'inherit',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
};

const textareaClassName = `${inputClassName} h-auto py-3 px-3.5 leading-[1.5] resize-none`;

const textareaInline = { fontSize: 16, fontFamily: 'inherit' };

export default function ComposeDrawer({ open, onClose, prefill = null }) {
  const toast = useToast();
  const send = useSendMessage();
  const { data: usersData } = useMessageRecipients();
  const [form, setForm] = useState({ to_user_id: '', subject: '', body: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Seed the form each time the drawer opens: a plain compose opens empty, while
  // a pre-filled flow (e.g. "Request reassignment") opens with recipient/subject/body set.
  useEffect(() => {
    if (open) {
      setForm({
        to_user_id: prefill?.to_user_id ?? '',
        subject:    prefill?.subject ?? '',
        body:       prefill?.body ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await send.mutateAsync(form);
      toast({ message: 'Message sent.' });
      onClose();
      setForm({ to_user_id: '', subject: '', body: '' });
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  const canSend = form.to_user_id && form.body.trim();

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      title="New message"
      subtitle="Send an internal message"
      footer={
        <>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            disabled={send.isPending || !canSend}
            onClick={handleSubmit}
            data-primary=""
            style={primaryBtnStyle(send.isPending || !canSend)}
          >
            {send.isPending && <DrawerSpinner />}
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-4 px-5 pb-2">

        <div>
          <FieldLabel label="To" icon={Users} htmlFor="compose-to" />
          <select id="compose-to" value={form.to_user_id} onChange={set('to_user_id')} className={selectClassName} style={selectInline}>
            <option value="">Select recipient…</option>
            {usersData?.data?.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel label="Subject" icon={AlignLeft} htmlFor="compose-subject" />
          <input
            id="compose-subject"
            placeholder="Re: Duty schedule"
            value={form.subject}
            onChange={set('subject')}
            className={inputClassName}
            style={inputInline}
          />
        </div>

        <div>
          <FieldLabel label="Message" icon={MessageSquare} htmlFor="compose-message" />
          <textarea
            id="compose-message"
            rows={5}
            value={form.body}
            onChange={set('body')}
            className={textareaClassName}
            style={textareaInline}
          />
        </div>

      </form>
    </BottomDrawer>
  );
}
