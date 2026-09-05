# Project Rules — Kemtit

## Workflow

1. **Before implementing anything**, run gitnexus to load context on the repo:
   - `gitnexus analyze` — index / update the knowledge graph for the current state of the repo.
   - Then `gitnexus query <search_query>` and/or `gitnexus context <symbol>` — pull the specific context relevant to the task before writing code.

2. **After finishing an implementation**, append an entry to `tracking-log.md` (project root). Each entry must include:
   - Date
   - Task / what was requested
   - Files changed (list)
   - Reason / context for the change
   - Result (what changed, any follow-ups or known issues)

3. **Reuse over creation**: prefer extending/reusing existing files, components, and patterns already in the repo. Do not create new files unless there is no reasonable way to fit the change into what already exists.

4. Apply other standard engineering judgment as needed (tests, type-checking, etc.) even when not explicitly listed here.
