# Handoff Reports Extension

Generates or updates a structured `handoff.md` report for the active feature after
specification, clarification, or implementation work, so the next session (or the next
agent) can pick up work without re-deriving context.

## Overview

This extension is invoked as an `after_specify`, `after_clarify`, and `after_implement`
hook, running **before** the git auto-commit step in each of those hooks so that the
handoff report is included in the same commit as the change it describes.

## Commands

| Command | Description |
|---------|-------------|
| `speckit.handoff.update` | Generate or update `specs/<feature-folder>/handoff.md` from `specs/_templates/handoff.md` |

## Hooks

| Event | Command | Optional | Description |
|-------|---------|----------|--------------|
| `after_specify` | `speckit.handoff.update` | No | Generate/update handoff.md before specification changes are committed |
| `after_clarify` | `speckit.handoff.update` | No | Generate/update handoff.md before clarification changes are committed |
| `after_implement` | `speckit.handoff.update` | No | Generate/update handoff.md before implementation changes are committed |

## Behavior

1. Determines the active feature folder (current Git branch name matched against
   `specs/<branch>/`, falling back to the most recently modified `specs/*/` directory).
2. Ensures `specs/<feature-folder>/handoff.md` exists, seeding it from
   `specs/_templates/handoff.md` if missing.
3. The calling agent then fills in every section of that file — `task_id`, `status`,
   `completed`, `failed_or_blocked`, `commands_run`, `constraints_discovered`,
   `deviations_from_constitution`, `files_touched`, `open_questions_for_owner` — based on
   the task that was just completed, overwriting the previous report for that feature.

## Graceful Degradation

- If no `specs/*/` feature folder can be determined: skips with a warning.
- If `specs/_templates/handoff.md` does not exist: skips with a warning.
- If `specs/<feature-folder>/handoff.md` already exists: it is left in place for the agent
  to overwrite with the current task's details (not silently discarded by the script).

## Scripts

- `scripts/bash/update-handoff.sh` — Bash implementation
- `scripts/powershell/update-handoff.ps1` — PowerShell implementation
