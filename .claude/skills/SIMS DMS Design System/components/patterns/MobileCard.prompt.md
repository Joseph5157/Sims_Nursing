**MobileCard** — the canonical list row that replaces tables on mobile (RULE 3). Primary + secondary text on the left; badge, action, and chevron on the right.

```jsx
<div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
  <MobileCard primary="Priya Sharma" secondary="Faculty · Pharmaceutics"
    badge={<Badge status="active" />} onClick={() => {}} />
  <MobileCard primary="Anil Kumar" secondary="Morning · 12 Mar"
    badge={<Badge status="late" />} onClick={() => {}} />
</div>
```

Rows self-divide with a bottom border — wrap them in a rounded white container with `overflow: hidden`. Pass `onClick` to make a row tappable (adds hover + chevron).
