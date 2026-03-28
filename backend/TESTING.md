# Unplugged — Testing Guide

## Automated Tests (pytest)

### Setup

```bash
cd backend
pip install -r requirements-test.txt
```

### Run All Tests

```bash
PYTHONPATH=. pytest tests/ -v --tb=short
```

### Run with Coverage Report

```bash
PYTHONPATH=. pytest tests/ -v --cov=. --cov-report=term-missing
```

### Run Specific Test Modules

```bash
# Service unit tests only
PYTHONPATH=. pytest tests/services/ -v

# Specific API module
PYTHONPATH=. pytest tests/test_members.py -v

# Single test
PYTHONPATH=. pytest tests/test_members.py::TestCreateMember::test_create -v
```

### Test Coverage Summary

| Module | Tests | Coverage |
|--------|-------|----------|
| Services (pure functions) | 57 | 86-100% |
| API Endpoints | 109 | 93-100% |
| Auth | 4 | 100% |
| WebSocket | 5 | 100% |
| Health | 1 | 100% |
| Models | — | 100% |
| **Total** | **182** | **96%** |

---

## Manual Testing Instructions

The following features require manual testing because they depend on external services, browser interaction, or visual inspection.

### 1. Google OAuth2 Calendar Flow

**Cannot be automated** — requires real Google credentials and browser-based OAuth consent.

**Prerequisites:**
- Set in `.env`:
  ```
  GOOGLE_CLIENT_ID=your-client-id
  GOOGLE_CLIENT_SECRET=your-client-secret
  GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/google-calendar/callback
  ```
- Google Cloud project with Calendar API enabled
- OAuth consent screen configured

**Steps:**

1. Start the app:
   ```bash
   docker compose -f docker-compose.dev.yml up
   ```

2. Create a member:
   ```bash
   curl -X POST http://localhost:8000/api/v1/members \
     -H "Content-Type: application/json" \
     -d '{"household_id":"default","name":"Test User","role":"parent"}'
   ```

3. Get OAuth authorization URL:
   ```bash
   curl http://localhost:8000/api/v1/google-calendar/auth-url?member_id=1
   ```

4. Open the returned URL in a browser. Sign in with Google and grant calendar permissions.

5. Google redirects to your redirect URI with `?code=XXX&state=1`. Exchange the code:
   ```bash
   curl -X POST http://localhost:8000/api/v1/google-calendar/callback \
     -H "Content-Type: application/json" \
     -d '{"code":"XXX","state":"1"}'
   ```

6. **Verify:** Response shows `{"success": true}`

7. Sync calendar:
   ```bash
   curl -X POST http://localhost:8000/api/v1/google-calendar/sync/1
   ```

8. **Verify:** Events from Google Calendar appear:
   ```bash
   curl http://localhost:8000/api/v1/schedules/week
   ```

9. Create a local event, sync again, and verify it appears in Google Calendar.

10. Modify an event in Google Calendar, sync again, and verify the local event is updated.

11. Disconnect:
    ```bash
    curl -X DELETE http://localhost:8000/api/v1/google-calendar/disconnect/1
    ```

12. **Verify:** Sync now returns 400 "Member has no Google Calendar connected"

**Edge cases to check:**
- Wait 1+ hour for token expiry — sync should auto-refresh the token
- Revoke access in Google account settings — sync should fail gracefully
- All-day events vs timed events from Google Calendar

---

### 2. Google Maps Travel Time

**Prerequisites:** Set `GOOGLE_MAPS_API_KEY` in `.env` (requires Google Maps Directions API enabled).

**Steps:**

1. Calculate travel time:
   ```bash
   curl "http://localhost:8000/api/v1/schedules/travel-time?from=123+Main+St,+New+York&to=456+Park+Ave,+New+York"
   ```

2. **Verify:** Returns `{"duration_min": N, "distance_km": N.N, "mode": "driving"}`

3. Create an event with a location:
   ```bash
   curl -X POST http://localhost:8000/api/v1/schedules/events \
     -H "Content-Type: application/json" \
     -d '{"household_id":"default","date":"2026-03-10","start_time":"09:00:00","end_time":"10:00:00","title":"Meeting","event_type":"appointment","location":"456 Park Ave, New York"}'
   ```

4. Calculate auto-travel:
   ```bash
   curl -X POST http://localhost:8000/api/v1/schedules/events/1/auto-travel \
     -H "Content-Type: application/json" \
     -d '{"from_location":"123 Main St, New York"}'
   ```

5. **Verify:** Event's `travel_time_min` is updated.

**Edge cases:** Invalid addresses, very long distances, special characters in addresses.

---

### 3. Frontend UI Testing

Open browser to `http://localhost:5173` (dev) or `http://localhost` (production).

#### Onboarding Wizard (shows when no members exist)
- [ ] Step 1: Enter household name — saved via API
- [ ] Step 2: Add members with name, role, age, avatar, color — each saved via API
- [ ] Step 3: Connect Google Calendar (optional) — OAuth flow works or skip
- [ ] Step 4: Summary shows correct info — click to proceed to dashboard
- [ ] Navigation: back/forward between steps works

#### Dashboard (`/`)
- [ ] All 6 cards render (Schedule, Meals, Budget, Score, Goals, Chores)
- [ ] Cards show real data after seeding (or empty states when no data)
- [ ] "Go Unplugged" button works
- [ ] Responsive layout at mobile / tablet / desktop widths
- [ ] Connection indicator shows Live/Offline status

#### Schedule View (`/schedule`)
- [ ] Weekly events listed with correct times and types
- [ ] Create event form: fill all fields — event appears in list
- [ ] Delete event — removed from list
- [ ] Free time blocks displayed at bottom
- [ ] Member color dots show correctly for assigned members

#### Meals View (`/meals`)
- [ ] Meal plan list with health scores, prep times, costs
- [ ] Create meal — appears in list with correct data
- [ ] Delete meal — removed from list
- [ ] Grocery list modal: click button — shows aggregated ingredients and total cost

#### Budget View (`/budget`)
- [ ] Category progress bars colored by usage (green/amber/red)
- [ ] Recent transactions list
- [ ] Create transaction — appears in list
- [ ] CSV Import Wizard:
  1. Upload a CSV file — preview loads
  2. Map columns (or auto-detect)
  3. Preview rows — data looks correct
  4. Confirm import — success message with count

#### Scoring View (`/scoring`)
- [ ] Today's score displayed as large number
- [ ] Log activity form — points calculated and shown
- [ ] 4-week trend bar chart renders
- [ ] Active streaks with day count

#### Goals View (`/goals`)
- [ ] Member tabs filter goals
- [ ] Create goal — appears under correct member
- [ ] Mark complete — streak counter increments, points shown
- [ ] Streak fire icon appears at 3+ consecutive days

#### Chores View (`/chores`)
- [ ] Member tabs filter chores
- [ ] Progress bar shows X of Y done with percentage
- [ ] Toggle checkbox — marks chore complete
- [ ] Verify button (as parent) — verified status shown

#### Unplugged Mode
- [ ] Click "Go Unplugged" — full-screen timer starts
- [ ] Timer counts down correctly
- [ ] End session — shows points earned
- [ ] Try starting second session while one is active — error handled gracefully

#### WebSocket Real-Time Updates (open 2 browser tabs)
- [ ] Create event in tab 1 — tab 2 updates without refresh
- [ ] Log activity in tab 1 — tab 2 score updates
- [ ] Start unplugged session — both tabs reflect it
- [ ] Disconnect network briefly, reconnect — WebSocket reconnects (exponential backoff)

---

### 4. Docker Deployment Testing

1. Build and start:
   ```bash
   docker compose up --build -d
   ```

2. Check containers:
   ```bash
   docker compose ps
   # All should show "healthy" or "running"
   ```

3. Health check (through Nginx):
   ```bash
   curl http://localhost/api/v1/health
   ```

4. Verify Nginx routing:
   - `/api/` routes to FastAPI backend
   - `/` serves React frontend SPA

5. Test data persistence:
   ```bash
   # Create some data
   curl -X POST http://localhost/api/v1/members \
     -H "Content-Type: application/json" \
     -d '{"household_id":"default","name":"Test","role":"parent"}'

   # Restart containers
   docker compose restart

   # Verify data persists
   curl http://localhost/api/v1/members
   ```

6. Check logs:
   ```bash
   docker compose logs backend
   # Should have no errors
   ```

7. Test from another device on LAN:
   ```bash
   curl http://<pi-ip>/api/v1/health
   ```

---

### 5. Raspberry Pi Performance Testing (Ubuntu 24.04 LTS)

1. SSH into the Raspberry Pi:
   ```bash
   ssh ubuntu@<static-ip>
   ```

2. Deploy via Docker Compose on Pi (Ubuntu ARM64):
   ```bash
   cd /path/to/My_AI_Mentor
   docker compose up -d
   ```

3. Seed data:
   ```bash
   docker compose exec api python scripts/seed.py
   ```

4. Measure response times natively via curl:
   ```bash
   time curl http://localhost/api/v1/budgets/summary
   time curl http://localhost/api/v1/schedules/free-blocks?days=30
   ```
   Target: < 500ms for typical queries

5. Monitor resources during usage:
   Open two SSH sessions. In one session, run htop to monitor overall Ubuntu system load:
   ```bash
   htop
   ```
   In the other, monitor Docker-specific container overhead:
   ```bash
   docker stats
   ```

6. Check database size:
   ```bash
   ls -la backend/data/unplugged.db
   ```

7. Leave running 24+ hours — verify no crashes or memory leaks via `docker stats`. Watch for excessive I/O wait (%) in `htop` which could indicate SD card wear/bottlenecking from SQLite writes.

---

### 6. API Authentication Testing

If you set `UNPLUGGED_API_KEY` in `.env`:

1. **Without auth header** — should return 401:
   ```bash
   curl http://localhost:8000/api/v1/members
   ```

2. **With valid key** — should return 200:
   ```bash
   curl -H "Authorization: Bearer your-key-here" http://localhost:8000/api/v1/members
   ```

3. **With wrong key** — should return 401:
   ```bash
   curl -H "Authorization: Bearer wrong-key" http://localhost:8000/api/v1/members
   ```

4. **Without key set (dev mode)** — all requests should succeed without auth header.
