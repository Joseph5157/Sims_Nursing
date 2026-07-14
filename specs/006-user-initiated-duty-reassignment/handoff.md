# Handoff Report

## task_id
006-user-initiated-duty-reassignment / mobile keyboard obscures searchable dropdown

## status
complete

## completed
- Audited every searchable/autocomplete dropdown in the client. Only two are affected by the
  mobile on-screen-keyboard bug: the **colleague picker** in
  `client/src/components/faculty/RequestReassignmentModal.jsx` (the reported case) and the
  **"Reassign to" faculty picker** in `client/src/pages/admin/DutySlotsPage.jsx` (line ~271).
  Both are Mantine `<Select searchable>` inside a `centered` Mantine `<Modal>`.
- Confirmed the faculty student-search in `RecordViolationModal.jsx` was already keyboard-aware
  (P21) and on mobile renders in a `dvh`-sized `BottomDrawer`; it needed no behavioural change.
- Root cause: `centered` vertically centers the modal in the *layout* viewport. On Android the
  soft keyboard overlays the layout viewport without shrinking `window.innerHeight`, so the
  modal's lower half — the Select and its downward-opening results list — is pushed behind the
  keyboard. Nothing listened to `visualViewport`, and the dropdown height was unbounded.
- Extracted the proven P21 `visualViewport` logic into a shared hook
  `client/src/hooks/useKeyboardInset.js` (returns px covered by the keyboard, 0 on desktop) and
  refactored `RecordViolationModal.jsx` to consume it (removed the inline copy + now-unused
  `useEffect` import).
- Fixed both Mantine modals: removed `centered`, top-anchored via
  `styles.inner.alignItems:'flex-start'`, reserved `kbInset` of bottom padding, capped
  `content` `maxHeight` to `calc(100dvh - kbInset - 10dvh)`, added `maxDropdownHeight={200}`
  (internal scroll) and an `onFocus` `scrollIntoView({block:'nearest'})` to the Select.
- Verified live in a mobile viewport (393×852, DPR 3) with a simulated 336px keyboard (shrunk
  `window.visualViewport`) using chrome-devtools MCP against a mock-seeded harness (no backend).
  Before: modal centered, "Jbr2" option + action buttons bled into the keyboard zone. After:
  modal lifts to the top, "Jbr2 Fernandes" is fully visible and tappable above the keyboard.
  Screenshots saved to the session scratchpad (before-colleague-bug.png / after-colleague-fixed.png).
- `npm run build` passes. No new eslint errors (the 2 remaining errors — `Date.now()` at
  RecordViolationModal:29 and the slot-reset `setState`-in-effect at RequestReassignmentModal:18
  — pre-exist on the untouched baseline, confirmed via `git stash` diff).

## failed_or_blocked
- Could not do a full end-to-end repro through real login: local Postgres (localhost:5433) is
  unreachable in this sandbox (no docker daemon), same constraint noted in prior sessions. Worked
  around it with a dev-only Vite harness that seeds the react-query cache directly; harness files
  were removed after verification.
- DutySlotsPage's admin picker was verified by build + identical-diff parity with the colleague
  picker (same Modal+Select pattern, same edit), not a separate live keyboard repro — isolating
  that full page needs several more mocked hooks (useMonthSlots/useReassignSlot/useMessageRecipients).

## commands_run
```
npx eslint <changed files>          # 0 new errors (2 pre-existing, confirmed via git stash)
npm run build                       # success
npx vite --port 5199                # dev-only harness for live mobile verification (stopped after)
git stash / git stash pop           # captured buggy baseline for before/after screenshots
```

## constraints_discovered
- `useKeyboardInset()` (`client/src/hooks/useKeyboardInset.js`) is now the shared primitive for
  keyboard-aware UI. Reuse it for any future searchable dropdown or bottom-anchored input rather
  than re-inlining the `visualViewport` listener.
- Mantine v9 `<Modal>` `centered` is the trap for mobile keyboard overlap; top-anchor + reserved
  `kbInset` bottom padding is the fix pattern. `withinPortal:false` on the combobox stays required
  for tappability (see mantine-select-in-drawer-gotcha).

## deviations_from_constitution
None.

## files_touched
- `client/src/hooks/useKeyboardInset.js` (new — shared visualViewport keyboard-inset hook)
- `client/src/components/faculty/RequestReassignmentModal.jsx` (modified — colleague picker fix)
- `client/src/pages/admin/DutySlotsPage.jsx` (modified — admin reassign picker fix)
- `client/src/components/faculty/RecordViolationModal.jsx` (modified — refactor to shared hook)

## open_questions_for_owner
- None. If other Mantine `<Modal>` forms grow text inputs near their bottom on mobile, apply the
  same `useKeyboardInset` + top-anchor pattern.
