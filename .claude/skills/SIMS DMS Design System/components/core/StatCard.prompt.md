**StatCard** — KPI tile with a colored left accent bar. Always use in a 2- or 3-column grid (never 1, never 3 on mobile per RULE 5).

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
  <StatCard label="Active Faculty" value={24} accent="blue" icon="👥" />
  <StatCard label="Pending Approvals" value={3} accent="yellow" sub="Needs action" icon="⏳" />
</div>
```

Accents: `blue`, `green`, `yellow`, `red`, `purple`, `default`. The number renders at 36px/800. Use `sub` for an at-a-glance status line ("All clear", "Awaiting review").
