# Project TODOs

## Completed
- Updated `PRD.md` to specify Ubuntu 24.04.4 Server LTS and ARM64 Docker multi-platform support [AGG3.1]
- Updated `STARTUP.md` to add Production Deployment Guide for Ubuntu 24.04 Server LTS, covering security, firewall, network, and storage [AGG3.1]
- Updated `PROGRESS.md` to track Phase 14 Deployment Documentation [AGG3.1]
- Updated `TESTING.md` to add manual verification tests for Ubuntu deployment security stack (UFW, fail2ban) [AGG3.1]
- Updated `backend/TESTING.md` with Ubuntu-specific performance monitoring steps for the Raspberry Pi testing section [AGG3.1]

## Technical Debt & Maintenance (V1.0 Remaining)
- Upgrade to timezone-aware datetimes to resolve `datetime.utcnow()` deprecation warnings across Pydantic models and SQLModel schema defs [AGG3.1]
- Implement an automated daily database backup job (e.g., using APScheduler and `scripts/backup.sh` to copy the SQLite WAL to cloud storage) [AGG3.1]

## Hardware & Deployment Enhancements
- Migrate SQLite database from SD card to external USB SSD to prevent wear-leveling corruption over long-term use [AGG3.1]

## V2.0 Cloud Migration Path (Phase 11 PRD Roadmap)
- Swap SQLite data layer to PostgreSQL via `.env` configuration [AGG3.1]
- Implement multi-tenant authentication via JWT and household data isolation middleware [AGG3.1]
- Scale deployment to cloud VPS or Kubernetes clusters using cloud docker compose overrides [AGG3.1]
- Integrate Plaid API for automated synchronization of household bank transactions [AGG3.1]
- Package OpenClaw Unplugged Skill for publishing to ClawHub registry [AGG3.1]
- Develop public SaaS landing page, onboarding API, and billing integration for multi-household public release [AGG3.1]
