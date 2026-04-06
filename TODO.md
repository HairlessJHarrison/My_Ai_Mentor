# Project TODOs

## Completed
- Updated `PRD.md` to specify Ubuntu 24.04.4 Server LTS and ARM64 Docker multi-platform support [AGG3.1]
- Updated `STARTUP.md` to add Production Deployment Guide for Ubuntu 24.04 Server LTS, covering security, firewall, network, and storage [AGG3.1]
- Updated `PROGRESS.md` to track Phase 14 Deployment Documentation [AGG3.1]
- Updated `TESTING.md` to add manual verification tests for Ubuntu deployment security stack (UFW, fail2ban) [AGG3.1]
- Updated `backend/TESTING.md` with Ubuntu-specific performance monitoring steps for the Raspberry Pi testing section [AGG3.1]
- Successfully deployed Unplugged to Raspberry Pi (Ubuntu 24.04.4 LTS) over remote SSH, completing server setup (UFW, Fail2ban, Docker) [AGG3.1]
- Fixed Nginx `docker-compose.yml` configuration crash by updating mount point to `/etc/nginx/conf.d/default.conf` rather than overwriting global root [AGG3.1]
- Exposed Google OAuth API environment variables to the backend FastAPI Docker containers in `docker-compose.yml` to resolve `GOOGLE_CLIENT_ID` missing keys [AGG3.1]
- Compiled and pushed production UI bundle (`frontend/dist`) to the Pi [AGG3.1]

- Added Google Calendar Settings page with connect/disconnect/sync UI accessible from dashboard gear icon
- Added `POST /api/v1/google-calendar/sync-all` endpoint for bulk calendar sync
- Added APScheduler hourly auto-sync for all connected Google Calendars
- Created reusable `/deploy-to-pi` Claude Code skill for deploying any Docker Compose project to Pi
- Established SSH key auth to Raspberry Pi for automated deployments
- Fresh git clone deployed to Pi at `~/projects/My_AI_Mentor` with latest code

---

## Bugs — High Priority

- **[High] Recurrence rules stored but never evaluated** — iCal recurrence rules are saved but recurring events don't actually repeat. Affects `free_block_finder.py` and the schedule model.
- **[High] Confetti fires before claim confirmation** — `AchievementsView.jsx:125` calls `showConfetti(true)` before the API call resolves. Move confetti trigger into the success handler of the API response.

## Bugs — Medium Priority

- **[Medium] Streak calculation off-by-one** — `backend/services/goal_tracker.py:64` adds today's completion to `streak_days` after yesterday-ending streaks are already summed, inflating the count by 1.
- **[Medium] `datetime.utcnow()` deprecated** — Breaks on Python 3.12+. Replace with `datetime.now(timezone.utc)` across all backend files. (Also tracked under Technical Debt below.)
- **[Medium] Service worker stale cache** — `frontend/public/sw.js` can serve a blank page on app updates. Add cache-busting or proper cache invalidation strategy.

## Bugs — Low Priority

- **[Low] 0/negative achievement target points allowed** — `api/achievements.py` is missing validation; target point values should be positive integers.
- **[Low] Broken achievement image URLs show nothing** — `AchievementsView.jsx` needs a fallback/placeholder image when an image URL fails to load.
- **[Low] Free block `overlapping_members` unused in UI** — The field is computed in the backend but never displayed in `ScheduleView.jsx`.

---

## High-Impact Features (Accountability Infrastructure)

- **Dashboard/home screen** — A "today at a glance" view showing today's schedule, active goal streaks, and achievement progress. Core accountability hook that drives daily return visits.
- **Goal deadlines** — Goals have frequency but no target date. Add an optional deadline field with countdown display to create urgency.
- **Reminders/notifications** — APScheduler is already in the stack. Wire up daily nudges for uncompleted goals (in-app or push notifications).
- **Log past completions** — `api/goals.py:110` hardcodes `date=dt.date.today()`. Allow users to log completions for past dates.
- **Points history graph** — Weekly/monthly bar chart of points earned to make streaks and progress feel tangible.
- **Sub-tasks/milestones for goals** — Goals are currently atomic. Allow breaking a goal (e.g., "Learn to cook") into ordered milestones.

## UI/UX Improvements

- **Achievement "unlock" animation** — Progress ring fills to 100% silently. Add a proactive alert or animation when an achievement becomes claimable.
- **Achievement renewal/seasons** — After claiming, there is no concept of reset or reuse. Add the ability to reuse achievements as recurring rewards.

---

## Technical Debt & Maintenance (V1.0 Remaining)

- Upgrade to timezone-aware datetimes to resolve `datetime.utcnow()` deprecation warnings across Pydantic models and SQLModel schema defs [AGG3.1]
- Implement an automated daily database backup job (e.g., using APScheduler and `scripts/backup.sh` to copy the SQLite WAL to cloud storage) [AGG3.1]
- Fix stale service worker cache causing blank page on fresh loads (clear `sw.js` cache or add cache-busting version) [V1.1]
- Set up Google Cloud OAuth credentials (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI) for production calendar sync [V1.1]
- Install Node.js on Pi for on-device frontend builds (currently built locally and scp'd) [V1.1]
- Set up passwordless sudo on Pi for jharrison user to enable fully automated deployments [V1.1]

---

## Hardware & Deployment Enhancements

- Migrate SQLite database from SD card to external USB SSD to prevent wear-leveling corruption over long-term use [AGG3.1]
- Add automated database backup mechanism — single SQLite file is a single point of failure.

---

## V2.0 Cloud Migration Path (Phase 11 PRD Roadmap)

- Swap SQLite data layer to PostgreSQL via `.env` configuration [AGG3.1]
- Implement multi-tenant authentication via JWT and household data isolation middleware [AGG3.1]
- Scale deployment to cloud VPS or Kubernetes clusters using cloud docker compose overrides [AGG3.1]
- Integrate Plaid API for automated synchronization of household bank transactions [AGG3.1]
- Package OpenClaw Unplugged Skill for publishing to ClawHub registry [AGG3.1]
- Develop public SaaS landing page, onboarding API, and billing integration for multi-household public release [AGG3.1]
