**Alert** — the inline banner that surfaces pending work on dashboards. Tinted card with a 3px left accent bar.

```jsx
<Alert tone="warning" icon="⏳" title="3 accounts awaiting approval"
  onClick={goToUsers}>Tap to review and approve.</Alert>

<Alert tone="telegram" icon="📲" title="2 users haven't linked Telegram yet">
  Resend invite links from the Users page.
</Alert>

<Alert tone="info" icon="✈️">OTP sent via <strong>@SIMSDMSBOT</strong> Telegram bot.</Alert>
```

Tones: `info` (blue), `success` (emerald), `warning` (amber), `danger` (red), `telegram` (cyan). Pass `onClick` to make the whole banner a tap target.
