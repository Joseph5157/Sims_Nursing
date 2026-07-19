import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMarkMessageRead } from '../hooks/useNotifications';
import { useInbox } from '../hooks/useMessages';

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function NotificationBell({ role }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const markRead = useMarkMessageRead();
  const { data: inboxData } = useInbox({ limit: 50 });

  const messagesBase = role === 'faculty' ? '/faculty/messages' : '/admin/messages';
  const inboxMessages = inboxData?.data ?? [];
  const unreadMessages = inboxMessages.filter((m) => !m.is_read);

  const totalUnreadCount = unreadMessages.length;

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [dropdownOpen]);

  function handleItemClick(message) {
    if (!message.is_read) {
      markRead.mutate(message.id);
    }
    setDropdownOpen(false);
    navigate(messagesBase);
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label={`Messages ${totalUnreadCount > 0 ? `(${totalUnreadCount} unread)` : ''}`}
        aria-pressed={dropdownOpen}
        title={`${totalUnreadCount} unread messages`}
        className="bg-transparent border-none cursor-pointer w-11 h-11 flex items-center justify-center relative rounded-[var(--radius-md)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-slate-100)]"
      >
        <Bell size={20} color="var(--color-blue-600)" strokeWidth={1.5} />
        {totalUnreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-[var(--color-red-solid)] text-white text-[length:var(--text-micro)] font-bold flex items-center justify-center border-2 border-[var(--surface-card)]">
            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 z-50 flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border)] shadow-[var(--shadow-dropdown)]"
          style={{
            top: 'calc(100% + 8px)',
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: 500,
          }}
          role="region"
          aria-label="Messages"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--divider)]">
            <p className="text-[length:var(--text-body)] font-[var(--weight-semibold)] text-[color:var(--text-primary)] m-0">
              Messages
            </p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {unreadMessages.length === 0 ? (
              <div className="px-4 py-8 text-center text-[color:var(--text-muted)] text-[length:var(--text-card)]">
                No unread messages
              </div>
            ) : (
              unreadMessages.map((m) => (
                <div
                  key={m.id}
                  className="px-4 py-3 border-b border-[var(--divider)] cursor-pointer transition-colors duration-[var(--dur-fast)] bg-[var(--color-cyan-bg)]"
                  onClick={() => handleItemClick(m)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(m);
                    }
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[length:var(--text-card)] font-[var(--weight-semibold)] text-[color:var(--text-primary)] m-0 mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                        {m.sender?.name || 'Unknown sender'}
                      </p>
                      <p className="text-[length:var(--text-small)] text-[color:var(--text-secondary)] m-0 mb-1 leading-[var(--leading-snug)] line-clamp-2">
                        {m.subject || '(No subject)'}
                      </p>
                      <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] m-0">
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                    <div
                      className="w-2 h-2 rounded-full bg-[var(--color-blue-500)] shrink-0 mt-1"
                      title="Unread"
                      aria-label="Unread"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {unreadMessages.length > 0 && (
            <div className="px-4 py-3 border-t border-[var(--divider)] text-center">
              <button
                onClick={() => { setDropdownOpen(false); navigate(messagesBase); }}
                className="text-[color:var(--color-blue-600)] no-underline text-[length:var(--text-card)] font-[var(--weight-semibold)] transition-colors duration-[var(--dur-fast)] hover:text-[color:var(--color-blue-700)] bg-transparent border-none cursor-pointer"
              >
                View all messages
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}