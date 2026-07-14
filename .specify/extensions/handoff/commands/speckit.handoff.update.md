---
description: "Generate or update specs/<feature-folder>/handoff.md from specs/_templates/handoff.md"
---

# Update Handoff Report

Generate or update the structured handoff report for the feature that was just worked on,
**before** the `after_specify` / `after_clarify` / `after_implement` auto-commit step runs,
so the report ships in the same commit as the work it describes.

## Behavior

1. Run the scaffolding script (see Execution below). It determines the active feature
   folder and ensures `specs/<feature-folder>/handoff.md` exists, seeding it from
   `specs/_templates/handoff.md` when it doesn't.
2. Using knowledge of the task that was just completed in this session, fill in (or
   overwrite) every section of `specs/<feature-folder>/handoff.md`:
   - `task_id` — the task/step identifier just worked on
   - `status` — `complete` / `partial` / `blocked`
   - `completed` — bullet list of what was finished and verified
   - `failed_or_blocked` — bullet list of what didn't work, with the reason
   - `commands_run` — shell commands actually executed
   - `constraints_discovered` — anything learned that wasn't already in `spec.md` or
     `CONSTITUTION.md`
   - `deviations_from_constitution` — any place the implementation differs from
     `CONSTITUTION.md`, and why (write "None" if there are none)
   - `files_touched` — files created, modified, or deleted
   - `open_questions_for_owner` — anything needing a decision from the project owner
3. Save the completed report to `specs/<feature-folder>/handoff.md`, overwriting whatever
   was there before. This must happen before the `speckit.git.commit` step in the same
   hook runs, so the handoff report is captured in the implementation commit.

## Execution

- **Bash**: `.specify/extensions/handoff/scripts/bash/update-handoff.sh [feature_folder]`
- **PowerShell**: `.specify/extensions/handoff/scripts/powershell/update-handoff.ps1 [feature_folder]`

When `feature_folder` is omitted, the script auto-detects it from the current Git branch
name, falling back to the most recently modified `specs/*/` directory.

## Graceful Degradation

- If no feature folder can be determined: skips with a warning, no commit is blocked.
- If `specs/_templates/handoff.md` is missing: skips with a warning.
- If `specs/<feature-folder>/handoff.md` already exists: it is left as-is by the script for
  the agent to overwrite with the current task's details.
