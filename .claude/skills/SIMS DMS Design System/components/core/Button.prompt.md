**Button** — primary action control. Use for any tappable action; the default size guarantees a 44px mobile hit target.

```jsx
<Button variant="primary" onClick={save}>Send OTP →</Button>
<Button variant="secondary" icon={<span>📋</span>}>Check In / Out</Button>
<Button variant="outline" size="sm">View →</Button>
<Button variant="danger" loading>Deleting…</Button>
```

Variants: `primary` (blue, default CTA), `secondary` (white/bordered), `danger` (red), `success` (emerald), `ghost` (text-only), `outline` (blue tint). Sizes: `xs`, `sm`, `default` (44px min on mobile), `lg`. Pass `loading` for an inline spinner, `icon` for a leading glyph.
