**Badge** — compact status / role pill. Pass a known `status` key to get the canonical tint + label used across the app (attendance, slots, users, violations, invites).

```jsx
<Badge status="active" />
<Badge status="late" />
<Badge status="super_admin" />
<Badge status="cover_pending" />
{/* Invite flow — PendingInvite rows (not yet a User) */}
<Badge status="invited" />        {/* link sent, awaiting Telegram activation */}
<Badge status="invite_expired" /> {/* link has lapsed — regenerate to extend  */}
<Badge label="3 unread" status="open" />
```

Known statuses cover attendance (`checked_in`, `checked_out`, `not_checked_in`, `late`, `absent`), slots (`scheduled`, `open`, `covered`, `cover_pending`, `expired`), accounts (`active`, `pending`, `pending_telegram`), invite rows (`invited`, `invite_expired`), and roles (`faculty`, `admin`, `super_admin`). Override the text with `label`.
