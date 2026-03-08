# MotoGO - Product Requirements Document

## Original Problem Statement
Social-mapping application for motorcyclists with features for route planning, live location sharing, events, friend management, police reporting, real-time map interactions, group chats, DMs, leaderboard, badges, and marketplace.

## User Personas
Romanian motorcyclists who want to plan routes, share locations with riding buddies, report police checkpoints, and organize group rides.

## Core Requirements
- Interactive map with route planning and POI markers (gas, service, events, police)
- Friend system with live location sharing
- Route management (create, start, pause, end rides)
- Event creation and participation
- Real-time messaging (DM + Group chats with unread badges)
- Police reporting with community voting
- Stories feature (time-limited posts)
- Leaderboard, badges/levels system
- Marketplace for second-hand gear

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 (TypeScript)
- **Backend**: FastAPI (Python) - server.py + /routers/
- **Database**: MongoDB (local dev / Atlas production)
- **Map**: Google Maps Platform + react-native-maps-clustering
- **Real-time**: Socket.IO
- **AI**: OpenAI GPT-4o

## Language
- Conversations with user: **Romanian**
- UI text / code / errors: **English**

---

## What's Been Implemented (Changelog)

### Session 1-2 (Feb 2026)
- User auth (register, login, JWT)
- Friend system (request, accept, remove)
- Route CRUD + static map previews
- Events system + RSVP
- "My Routes" control panel (Start/Pause/End/Directions)
- Map Phase 1-3: Location sharing toggle, friends on map, police reports, silent loading
- Friend callout overlays (iOS + Android custom overlay system)
- Unread message badge fix for group chats (useEffect → mark-read API)
- Backend routers: extracted auth.py, friends.py, location.py from server.py

### Session 3 — Responsive Layout (Feb 21, 2026)
- Applied `useBottomTabBarHeight` + dynamic `paddingBottom` to ALL 8 tab screens
- Fixed `community.tsx`: ChatsTab & GroupsTab — ScrollView with dynamic paddingBottom
- Fixed `store.tsx` (Rankings): FlatList + 2 ScrollViews with dynamic paddingBottom
- Cleaned unused imports: `notifications/index.tsx`, `profile/friends.tsx`
- All stack screens use `SafeAreaView` correctly

### Session 4 — Features + Fixes (Mar 3, 2026)
- **Ride Score Chip**: `src/hooks/useRideScore.ts` + `src/components/RideStatusChip.tsx`
  - Open-Meteo API (free, no key), score 0-10 algorithm, 10min cache (AsyncStorage)
  - Chip: [RideChip] [ShareLocationToggle] [CreateBtn] in MapScreen header
  - Bottom sheet: score badge, summary, Temp/Wind/Rain%, label, disclaimer
  - States: loading (skeleton), offline (stale cache), no-permission (grey)
- **UI Design System**: `src/theme/design.ts` — typography, button, card, sheet tokens
  - Fixed events.tsx, routes.tsx, shop.tsx: h1 24→22, sub 14→13
  - Fixed notifications/index.tsx: buttons 40→44 r20→r14
  - Fixed profile/friends.tsx: Inter_900Black → Inter_700Bold (stack title)
- **Date/Time Picker**: installed `@react-native-community/datetimepicker@8.6.0`
  - Created `src/components/DateTimePickerField.tsx` (iOS spinner sheet + Android native dialog)
  - Applied to `create/event.tsx`, `create/route.tsx`, `event/[id].tsx`
  - Date shown in Romanian (ro-RO locale)
- **Deployment Fix**: installed `react-native-worklets@0.7.4` (required by react-native-reanimated@~4.1.1 v4 peer dependency)

### Session 5 — Critical Bug Fixes (Mar 3, 2026)
- **`useBottomTabBarHeight` crash fix**: Created `src/hooks/useSafeTabBarHeight.ts` — safe wrapper that returns fallback value (90px iOS / 70px Android) when BottomTabBarHeightContext is unavailable. Replaced in all 7 tab screens: home, routes, map (events), shop, profile, community, store
  - Root cause: `useBottomTabBarHeight()` from `@react-navigation/bottom-tabs` throws if context is undefined (happens on Expo Go / certain render timing)
- **MongoDB index conflict fix**: Made ALL index creation idempotent in `database.py` using `_safe_create_index` wrapper. Each index is created independently with try/except
- **Non-blocking startup**: Changed `ensure_indexes()` to run via `asyncio.create_task()` so backend starts instantly without waiting for Atlas
- **MongoDB client resilience**: Added explicit timeouts (serverSelectionTimeoutMS=30000, connectTimeoutMS=20000, socketTimeoutMS=20000)
- **`.gitignore` fix**: Removed broad `*.env` pattern that blocked `.env` files from deployment

### Session 6 — Layout Refactor: Shop & Community (Mar 3, 2026)
- **Shop header redesign**: Moved Search, My Listings, Add Listing buttons to header right (matching Home's 44x44 icon style). Search bar between header and tabs. Content area only shows categories + listings grid
- **Community header redesign**: Moved Create Group and Search to header right. Removed big "Create Group" card. Search = only group search
- **Shop listing cards**: Removed seller username from cards (visible only on detail page), reduced spacing between categories and listings
- **UI consistency**: All headers now use identical tokens: fontSize 22, fontWeight 900, 44x44 icon buttons

### Session 7 — Map Full-Width + Listing Chat + Profile Edit (Mar 3, 2026)
- **Map full-width**: Removed margin/borderRadius from MapCanvas.native.tsx - map renders edge-to-edge
- **Listing Chat System** (Backend + Frontend):
  - Backend: `/app/backend/routers/listing_chat.py` - 6 API endpoints with TTL 30 days auto-delete
  - Frontend: chat.tsx (chat screen), listing-messages.tsx (seller conversations list), my-listings.tsx (Messages badge per listing)
  - Listing detail: "Message Seller" button opens listing chat (not Community DM)
  - Fixed ObjectId serialization bugs with JSONResponse + json_util
  - Listing chat indexes ensured at startup
- **Profile Edit redesign**:
  - Username now editable (TextInput) with backend uniqueness validation (409 Conflict)
  - Removed entire "Confidentialitate" (Privacy) section
  - Added support@motogo.life email link (mailto:)
  - Cleaned up dead code (loadPrivacy, togglePrivacy, cycleRoutesVisibility, Switch)

### Session 8 — Deployment Unblock + Meeting Point UI Complete (Mar 8, 2026)
- **Deployment blocker fixed**: repaired missing component closure in `frontend/src/components/MapCanvas.native.tsx`; Expo web export now completes successfully again
- **Meeting Point frontend complete**:
  - `app/(tabs)/routes.tsx` now shows meeting point owner card in **My Routes** with name, address, radius chip, distance text, and `Navigate to meeting point`
  - Start button is disabled when meeting point is missing, location is unavailable, rider is too far from meeting point, or participant minimum is not met
  - User location now updates continuously (native watcher + browser geolocation watcher)
- **Route detail page**: `app/route/[id].tsx` now renders a dedicated meeting point section with radius text and navigation button
- **Backend API fix**: `GET /api/routes/my` now returns `meeting_point` and `start_radius_km`; `POST /api/routes` now returns **201 Created**
- **Verification status**:
  - Expo web export: PASS
  - API smoke tests: PASS (`/api/routes`, `/api/routes/my`, create/delete route with meeting point)
  - Testing agent iteration 12: PASS for meeting point flows and frontend load

**Pending: Backend refactor** - server.py has 4460 lines / 70+ endpoints. Needs incremental migration to routers: marketplace, events, routes, rides, stories, groups, notifications, messages, users

---

## Pending Issues (Priority Order)

### P0 — Needs User Verification
- **Deployment/build stability**: syntax blocker in `MapCanvas.native.tsx` fixed; user should verify the updated build on target devices
- **Meeting Point ride start flow**: UI complete and tested with temporary routes; user should verify with their own routes after deploy/update
- **Ecran negru Expo Go**: Fix aplicat (`useSafeTabBarHeight`). User trebuie să testeze pe mobil
- **Badge mesaje necitite grup**: Fix implementat. User trebuie să testeze după deploy
- **Map callout Android**: Custom overlay implementat. User trebuie să testeze tap marker prieten pe Android
- **Date/Time Picker**: Picker nativ implementat. User trebuie să testeze creare/editare eveniment și traseu

### P1 — Known Bugs
- **Eroare pauză traseu**: `PUT /api/routes/pause/{route_id}` — fix aplicat dar NETESTAT
  - Test: `curl -X PUT {API}/api/routes/pause/{route_id} -H "Authorization: Bearer {token}"`
- ~~**MongoDB Atlas Index Conflict**~~: REZOLVAT — crearea indexului făcută idempotentă în `database.py`
- **Date inconsistency on legacy routes**: multe rute vechi au `meeting_point: null`; pentru verificare completă UI este nevoie de rute noi/create cu meeting point setat

### P1 — 401 Unauthorized în Production (după un timp)
- Pattern: primele request-uri reușesc (200), apoi TOATE devin 401
- Cauza probabilă: JWT_SECRET diferit între sessii sau token expiry
- Verificați că `JWT_SECRET` în `.env` e consistent între deployment-uri
- Dacă problema persistă: verificați `decode_access_token()` din `server.py` / `routers/auth.py`

### P2
- **Buton Recenter hartă invizibil**: Investigare `MapCanvas.native.tsx` (styling/z-index)
- **Backend refactor incomplet**: `server.py` mai conține endpoint-uri de mutat în:
  - `routers/routes.py`, `routers/events.py`, `routers/rides.py`, `routers/map.py`, `routers/messages.py`

### Blocat
- **Forgot Password**: Necesită cheie API email service (SendGrid/Resend)

---

## Key Files Reference

### Frontend
- Map screen: `/app/frontend/src/screens/MapScreen.tsx`
- Map canvas: `/app/frontend/src/components/MapCanvas.native.tsx`
- Ride chip: `/app/frontend/src/components/RideStatusChip.tsx`
- Ride score hook: `/app/frontend/src/hooks/useRideScore.ts`
- Date picker: `/app/frontend/src/components/DateTimePickerField.tsx`
- Design tokens: `/app/frontend/src/theme/design.ts`
- Colors: `/app/frontend/src/theme/colors.ts`
- Tab screens: `/app/frontend/app/(tabs)/`
- Stack screens: `/app/frontend/app/event/[id].tsx`, `route/[id].tsx`, `community/group/[groupId].tsx`, `community/dm/[userId].tsx`
- Create screens: `/app/frontend/app/create/event.tsx`, `create/route.tsx`

### Backend
- Main: `/app/backend/server.py`
- Routers: `/app/backend/routers/auth.py`, `friends.py`, `location.py`
- Env: `/app/backend/.env`

---

## Test Credentials
- User 1: `user1@example.com` / `Password123`
- Register fresh user: `testuser_gen@example.com` / `TestPass123!`

## API Base URL (production preview)
- `https://ride-start-gating.preview.emergentagent.com`

## Environment Notes
- Backend port: 8001 (internal), all routes prefixed `/api`
- Frontend: `REACT_APP_BACKEND_URL` / `EXPO_PUBLIC_BACKEND_URL`
- MongoDB: `MONGO_URL` from `/app/backend/.env`
- Hot reload active — restart supervisor only for .env / dependency changes

## Key API Endpoints
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- Friends: `GET /api/friends`, `POST /api/friends/request`, `GET /api/friends/locations`
- Routes: `GET /api/routes`, `POST /api/routes`, `PUT /api/routes/pause/{id}`
- Rides: `POST /api/rides/start`, `POST /api/rides/pause`, `POST /api/rides/end`
- Events: `GET /api/events`, `POST /api/events`, `PUT /api/events/{id}`
- Messages: `GET /api/messages/inbox`, `POST /api/messages/mark-read`
- Map: `GET /api/map/events`, `GET /api/map/police-reports`, `POST /api/map/police-reports`
- Notifications: `GET /api/notifications`, `GET /api/notifications/unread-count`
