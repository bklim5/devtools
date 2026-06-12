## 2026-06-12 — plan 01 execution

- **gsd-tools `roadmap update-plan-progress` edits the wrong section**: it rewrote the
  backlog 999.1 "**Plans:**" line (stale "4/4 plans complete" → "1/4 plans executed").
  Reverted to "TBD" manually. Future executors: verify ROADMAP diffs after running it
  (matches the known "gsd-tools custom STATE/ROADMAP format" memory).
- **Requirements LIC-01/02/04 deliberately NOT checked off after plan 01**: the
  `requirements mark-complete` call from the executor recipe was reverted — plan 01 is
  SPIKE/infra only; plans 02/03/04 carry the same IDs and the implementing plan should
  mark them at phase completion.
