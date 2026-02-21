# MotoGO - Product Requirements Document

## Original Problem Statement
Social-mapping application for motorcyclists with features for route planning, live location sharing, events, friend management, police reporting, and real-time map interactions.

## User Personas
- Romanian motorcyclists who want to plan routes, share locations with riding buddies, report police checkpoints, and organize group rides.

## Core Requirements
- Interactive map with route planning and POI markers (gas, service, events, police)
- Friend system with location sharing
- Route management (create, start, pause, end rides)
- Event creation and participation
- Real-time location sharing between friends
- Police reporting with community voting
- Stories feature (time-limited posts)
- Messaging/DM system

## Tech Stack
- **Frontend**: React Native / Expo (TypeScript)
- **Backend**: FastAPI (Python) - Monolithic server.py
- **Database**: MongoDB
- **Map**: Google Maps Platform + react-native-maps-clustering
- **Real-time**: Socket.IO
- **AI**: OpenAI GPT-4o

## What's Been Implemented

### Latest Updates (Feb 21, 2026)
- **Friend Popup on Map (NEW):**
  - Click on friend marker shows callout with: photo + username, active ride status, distance from you, message button
  - Backend: Updated `/api/friends/locations` to include `active_ride` and `distance_km` fields
  - Backend: Added `/api/friends/{friend_id}/detail` endpoint
  - Frontend: Added `onFriendPress` handler to open DM with friend
- **Backend Refactoring (IN PROGRESS):**
  - Created `/app/backend/routers/` directory structure
  - Extracted authentication endpoints to `/app/backend/routers/auth.py`
  - Extracted friends endpoints to `/app/backend/routers/friends.py`
  - Extracted location endpoints to `/app/backend/routers/location.py`
- **Map UI - Responsive Layout:**
  - "Report Police" and "Recenter" buttons now in a flexbox container (responsive for all screen sizes including 9:16)
  - Silent loading indicator (small spinner near filter chips instead of blocking overlay)
- **Android UI Bug Fixes (Feb 21, 2026):**
  - Global status bar padding via root layout on Android (prevents overlap across all screens)
  - Map: recenter button lifted above tab bar; loading indicator now a static green dot
  - Friend popup: distance text set to neon green; DM navigation route fixed (`/community/dm/:userId`)
  - Map styling adjusted for clearer streets on dark theme
- **Ride Banner Enhancement:**
  - Added "Directions" button (navigate icon) to active ride banner
  - Added "End Route" button (stop icon, red) for ride creators
- **Friends API Fix:**
  - Fixed `fetchFriendsLocations` to pass proper `authHeader` object

### Completed Features
- User auth (register, login, JWT)
- Friend system (request, accept, remove)
- Route CRUD + static map previews
- Events system
- "My Routes" control panel (Start/Pause/End/Directions)
- Map Phase 1: "+" create button + Location Sharing toggle
- **Map Phase 2: Friends on Map** (Feb 2026)
  - Backend: `POST /api/location/update`, `GET /api/friends/locations`
  - Frontend: Friends filter chip (people icon) in filter row
  - Friend markers on map with initials + online status (live vs. last seen)
  - Location sharing sends updates every 15s, fetches friends every 20s
- **Map Phase 3: Silent Loading** (Feb 21, 2026)
  - Replaced blocking loading overlay with subtle spinner indicator
  - Responsive button layout using Flexbox
- Police reporting with community voting
- Stories feature
- Messaging system
- Registration error fix (Pydantic error parsing)
- Friend re-add fix (payload correction)
- End Route error fix (payload correction)
- English error messages

### API Endpoints (Key)
- `POST /api/auth/register`, `POST /api/auth/login`
- `POST /api/friends/request`, `POST /api/friends/remove`
- `POST /api/location/update` - Update user's live location
- `GET /api/friends/locations` - Get friends' recent locations (30min window)
- `POST /api/routes/{route_id}/start`, `POST /api/routes/active/finish`
- `POST /api/routes/active/pause`, `POST /api/routes/active/resume`

## Database Access
- **Connection**: `mongodb://localhost:27017`
- **Database**: `test_database`
- **Collections**: users, routes, ride_sessions, friends, events, stories, messages, notifications, police_reports, marketplace_listings, groups, badges

## Prioritized Backlog

### P0
- (DONE) Map Phase 3: Silent refresh
- (DONE) Map Phase 4: Police Reports optimistic UI

### P1
- Backend refactor: Split server.py into APIRouter modules (IN PROGRESS)
  - DONE: auth.py, friends.py, location.py
  - TODO: routes.py, users.py, events.py, rides.py, map.py, messages.py

### P2
- Map Phase 5: UI Polish (filter text labels, recenter button refinement)

### Blocked
- Forgot Password flow (needs email service API key)

## Test Credentials
- user1@example.com / Password123
- user2@example.com / Password123

## Language
- UI error messages: English
- Conversational interactions: Romanian

## Router Structure (Backend Refactoring)
```
/app/backend/routers/
├── auth.py       # Register, login endpoints
├── friends.py    # Friends CRUD, locations, requests
└── location.py   # User location updates
```

## Key Files Reference
- Frontend Map: `/app/frontend/src/screens/MapScreen.tsx`, `/app/frontend/src/components/MapCanvas.native.tsx`
- Backend Main: `/app/backend/server.py`
- Database: `/app/backend/database.py`
