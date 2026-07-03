# Decisions Log

Running record of ambiguous calls made while executing the v1 → production plan, in autonomous mode. Newest entries at the bottom of each phase's section.

---

## Phase 0

- **Regenerated AUDIT.md from scratch rather than trusting the previous session's version or its commit messages.** Several things the earlier commits claimed to have done (e.g. "Phase 2: Security hardening") were only partially true on direct inspection: escrow CAS and `/api/ai` auth are genuinely solid, but `lib/notify.js` is not the Web Push helper the spec requires, the SW shell caching bug is not fixed, and the session-expiry/role-guard bugs are still present. Treated every claim as unverified until read directly.
- **Left the stray worktree `.claude/worktrees/agent-a379f348930be3706/` untouched.** It's a full second checkout on its own branch from a previous agent run. Not part of this task's scope; deleting worktrees is a destructive, hard-to-reverse action outside what was asked. Flagged here for the user to clean up manually if it's no longer needed (`git worktree remove`).
- **No `assets/logo_Crew.png` or any Crew logo file exists anywhere in the repo** (searched by filename pattern, zero hits). Per the autonomous defaults, Phase 4 will generate a clean interim "Crew" wordmark icon (white text on #1a4d33) rather than stopping to ask. **Action required from the user:** replace the interim icons with the official logo before public launch.

---

## Phase 1

*(populated as Phase 1 executes)*
