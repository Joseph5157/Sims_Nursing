**Table** — the product's data table shell. Compose `Table > thead > Tr > Th` and `tbody > Tr > Td`. Use `EmptyRow` for zero-state. Pass `hidden` to `Th`/`Td` to hide columns at narrow widths (matches the mobile fixes in `MOBILE_UI_FIXES.md`).

```jsx
<Table>
  <thead>
    <tr>
      <Th>Name</Th>
      <Th>Role</Th>
      <Th hidden={isMobile}>Department</Th>
      <Th>Status</Th>
    </tr>
  </thead>
  <tbody>
    {users.length === 0
      ? <EmptyRow cols={4} message="No users found." />
      : users.map(u => (
          <Tr key={u.id} onClick={() => openUser(u)}>
            <Td>{u.name}</Td>
            <Td><Badge status={u.role} /></Td>
            <Td hidden={isMobile}>{u.department}</Td>
            <Td><Badge status={u.status} /></Td>
          </Tr>
        ))
    }
  </tbody>
</Table>
```

Mobile column hiding: wrap the page in a state check (`window.innerWidth < 640`) or pass a prop. The `hidden` shorthand on `Th`/`Td` returns `null` to skip the cell entirely.
