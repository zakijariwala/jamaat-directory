# Jamaat Directory: notes for coding sessions

Read these first, in this order:
1. `docs/PROGRESS.md`: current state, go-live steps, pilot table
2. `TODO.md`: the checklist (🔴 launch blockers first)
3. `docs/DECISIONS.md`: settled decisions and why; don't reopen them without the user
4. `docs/DEPENDENCIES.md`: what blocks what, services, secrets

Rules that must hold:
- No phone number ever reaches `directory.json` or the static pages. Public
  shapes are built field by field in `src/lib/snapshot.ts`; the test in
  `test/snapshot.test.ts` enforces it. Numbers are served only by `/api/reveal`.
- Contacts publish only if self-added or consented. People are never bulk-imported.
- Everything submitted or imported lands as `pending`; only `/moderate` makes it live.
- `src/data/seed.ts` is fictional dev/test data. Never add real data there.
- New D1 columns need a migration, plus updates to the column lists in
  `src/lib/ingest.ts`, `scripts/gen-seed-sql.ts` and `scripts/import-listings.ts`.

Checks before pushing: `npm test`, `npm run typecheck`, `npm run build`
(the build needs internet; offline use `DIRECTORY_SOURCE=seed`).

At the end of a session, update `docs/PROGRESS.md` (snapshot + session log),
tick `TODO.md`, and log new decisions in `docs/DECISIONS.md`.
