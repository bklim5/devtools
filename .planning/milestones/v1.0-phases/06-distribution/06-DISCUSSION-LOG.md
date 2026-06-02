# Phase 6: Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 06-distribution
**Areas discussed:** Signing & notarisation identity, Release & update hosting, Updater UX & trigger, Build & release process

---

## Gray Area Selection

| Option | Selected |
|--------|----------|
| Signing & notarisation identity | ✓ |
| Release & update hosting | ✓ |
| Updater UX & trigger | ✓ |
| Build & release process | ✓ |

**User's choice:** All four.

---

## Signing & Notarisation Identity

### Q: Apple Developer Program status?
| Option | Selected |
|--------|----------|
| Have membership + cert ready | |
| Have membership, no cert yet | |
| No membership yet | ✓ |
| Not sure / help me check | |

**User's choice:** No membership yet.
**Notes:** Drove the "wire everything, gate notarisation on cert" strategy (notarisation impossible without enrolment).

### Q: Notarytool auth method?
| Option | Selected |
|--------|----------|
| App Store Connect API key (Recommended) | ✓ |
| Apple ID + app-specific password | |
| You decide | |

**User's choice:** App Store Connect API key.

### Q: Where should signing secrets live?
| Option | Selected |
|--------|----------|
| Local env / keychain only | (effectively, for this phase) |
| Repo-managed (gitignored) config | |
| You decide | |

**User's choice (free text):** "This is a git repo, ideally whenever there is a CI push these should be covered (let's plan this in the next phase), help me decide which approach would be better."
**Resolution:** Claude recommended local gitignored env vars this phase → lift-and-shift to GitHub Actions encrypted secrets when CI lands in a follow-on phase; nothing secret in git. User confirmed ("Yes, lock it"). CI becomes a deferred phase.

### Q (follow-up): How should Phase 6 handle notarisation given no enrolment?
| Option | Selected |
|--------|----------|
| Wire everything, gate notarise on cert (Recommended) | ✓ |
| Enrol now, then full sign + notarise | |
| Ad-hoc DMG + documented override, defer notarise to v2 | |

**User's choice:** Wire everything, gate notarise on cert.

---

## Release & Update Hosting

### Q: Where to host DMG + latest.json?
| Option | Selected |
|--------|----------|
| GitHub Releases (Recommended) | ✓ |
| Own server / S3 bucket | |
| You decide | |

**User's choice:** GitHub Releases.

### Q: Manifest endpoint style?
| Option | Selected |
|--------|----------|
| Static latest.json (Recommended) | ✓ |
| GitHub's dynamic endpoint | |
| You decide | |

**User's choice:** Static latest.json.

---

## Updater UX & Trigger

### Q: When/how to check for updates?
| Option | Selected |
|--------|----------|
| Manual-only via tray menu (Recommended) | |
| Check on launch + manual item | |
| Check on launch, opt-in via first-run toggle | ✓ |

**User's choice:** Check on launch, opt-in via first-run toggle.

### Q: How should an update apply?
| Option | Selected |
|--------|----------|
| Prompt, then install on user confirm (Recommended) | ✓ |
| Download + install on next quit | |
| You decide | |

**User's choice:** Prompt, then install on user confirm.

### Q: In-app affordance beyond the tray?
| Option | Selected |
|--------|----------|
| Tray menu only (Recommended) | |
| Tray + an About/menu surface | (extended) |
| You decide | |

**User's choice (free text):** "Tray and about/menu surface, we can also show an in app banner that user can dismiss when there is newer version updated everytime."
**Resolution:** Three surfaces — tray menu + native About/app menu + a dismissible in-app banner shown whenever a newer version is detected.

---

## Build & Release Process

### Q: Where should the release build run this phase?
| Option | Selected |
|--------|----------|
| Local Mac now, CI next phase (Recommended) | ✓ |
| Build CI pipeline in this phase | |
| You decide | |

**User's choice:** Local Mac now, CI next phase.

### Q: Tauri updater minisign keypair handling?
| Option | Selected |
|--------|----------|
| Generate now, store locally + document (Recommended) | ✓ |
| You decide | |

**User's choice:** Generate now, store locally + document.

### Q: Version bumping / release cutting?
| Option | Selected |
|--------|----------|
| Manual bump + documented runbook (Recommended) | ✓ (now) |
| Git-tag-driven | (eventually, via CI) |
| You decide | |

**User's choice (free text):** "Manual bump for now, but eventually it should come with every merge to master/main branch via CI pipeline."

---

## Claude's Discretion

- Hardened-runtime entitlements, DMG layout/background, exact updater config block, banner copy/placement, RELEASE.md structure, CSP/capability widening for the updater endpoint.

## Deferred Ideas

- **CI / release-automation phase** (GitHub Actions on merge-to-main: sign → notarise → publish to GitHub Releases → update latest.json → secrets in encrypted Actions secrets → tag/merge-driven versioning).
- Apple Developer Program enrolment (out-of-band prerequisite).
- Windows + Linux signing/packaging.
- Protobuf decimal-byte-array input mode (unrelated Phase-3 backlog item).
