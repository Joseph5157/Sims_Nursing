# Specification Quality Checklist: Telegram OTP Login

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Validation iteration 1 — 2026-07-15

One item failed: `FR-016` carried the sole `[NEEDS CLARIFICATION]` marker — the recovery path for
an account locked by repeated failed code attempts. Deliberately left open rather than defaulted,
as the one decision in the spec with no defensible default. All other items passed.

### Validation iteration 2 — 2026-07-15 (all items pass)

Clarification resolved by the project owner: **time-based cool-off only**. Encoded as FR-016,
FR-016a (cool-off is the *only* path — no admin unlock, no password-login shortcut), and FR-016b
(requesting a new code during cool-off does not lift the lock — otherwise the attempt limit would
be bypassable by simply asking for another code). Three matching acceptance scenarios added to
User Story 3, plus SC-004a, plus two edge cases (locked user requesting a code mid-cool-off; the
Super Admin locking themselves out).

Final counts: 24 functional requirements, 9 success criteria, 3 prioritised user stories
(P1/P1/P2), 11 edge cases.

**Consequence surfaced during this iteration, recorded in Assumptions:** a time-based cool-off
needs to know *when* the lock started, and the dormant `otp_failed_attempts` field is a bare
integer that records only *how many* failures. The original brief said to reuse that column rather
than add anything; that still holds for the count, but the count alone cannot answer "has the
cool-off elapsed?", so one additional piece of per-user timestamp state is unavoidable. Flagged
explicitly rather than quietly absorbed, since it departs from the stated instruction. `plan.md`
picks the mechanism.

### Known-stale inputs (recorded in the spec's Assumptions rather than silently trusted)

1. `.specify/memory/constitution.md` contradicts the real `CONSTITUTION.md` on roles (4 vs 3),
   tables (14 vs 18), endpoints (55 vs 115), and auth model (OTP-only vs password+magic-link). It
   is a snapshot of the original pre-abandonment design, and its own header defers to
   `CONSTITUTION.md` as the source of truth. Used here only as the historical source of the
   5-minute / 5-attempt parameters — which also explain why a dormant `otp_failed_attempts` column
   still exists on the User model.
2. `CONSTITUTION.md` §4's "No Telegram OTP (the code-entry kind)" is the decision this feature
   reverses. FR-022 requires that reversal be recorded explicitly in the constitution's version
   history, per the precedent 022 set when it reopened the same broader question.

**Status**: All criteria met. Ready for `/speckit-plan`.
