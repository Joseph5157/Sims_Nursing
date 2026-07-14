**Input** — labelled text field. 44px tall (mobile-friendly), uppercase label, blue focus ring, red error state.

```jsx
<Input label="Email Address" placeholder="your.email@college.edu" />
<Input label="Registration No." hint="Format: SIMS-2024-001" />
<Input label="Phone" error="Enter a valid 10-digit number" />
```

Forwards all native `<input>` props. Use `hint` for format guidance, `error` for validation messages.
