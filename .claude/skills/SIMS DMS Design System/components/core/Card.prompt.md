**Card** — the standard white surface used for every grouped block. Optional `title` gives a tinted header bar with an optional right-aligned `headerAction`.

```jsx
<Card title="📋 Today's attendance" headerAction={<Badge status="open" />}>
  …rows…
</Card>

<Card padded={false}>{/* edge-to-edge list */}</Card>
```

Set `padded={false}` when the body is a divider-separated list (rows handle their own padding).
