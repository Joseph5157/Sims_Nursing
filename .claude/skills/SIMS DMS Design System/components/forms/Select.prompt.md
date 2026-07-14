**Select** — native dropdown styled to match `Input`, with a custom chevron.

```jsx
<Select label="Session" options={['Morning', 'Afternoon']} placeholder="Choose a session" />
<Select label="Role" options={[
  { value: 'faculty', label: 'Faculty' },
  { value: 'admin', label: 'Admin' },
]} />
```

Accepts `options` as plain strings or `{ value, label }` objects. Forwards all native `<select>` props.
