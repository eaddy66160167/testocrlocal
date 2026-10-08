# Baseline verification — 2026-10-08

Imported production f9765f6 into testing feature/local-first, retaining both Git histories.
Frontend npm ci and npm run build passed (Next 16.3.4); all existing routes compiled.
Dependency install reported 9 vulnerabilities (8 high, 1 critical); deployment is gated pending dependency review.
Backend Python 3.12 isolated venv: pytest -q: 217 passed, 51 failed, 5 skipped in 39.73 seconds.
Failures predate migration. Many legacy tests request removed fixed pipeline IDs (mint/hutch/benchmark), expect removed adapter_classes, or expect persistent logs disabled by current source. Global-layout failures must be triaged individually; not all failures are asserted to be obsolete.
These results do not certify functional parity or deployment readiness. No production or Neon runtime was contacted by this suite.
