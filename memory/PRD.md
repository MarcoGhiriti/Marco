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
- **MongoDB index conflict fix**: Made TTL index creation idempotent in `database.py` by wrapping `stories.create_index` and `story_views.create_index` in individual try/except blocks
  - Root cause: `database.py` created index without name (→ `expires_at_1`), `server.py` tried to create same index with name `stories_ttl_idx` → conflict

---

## Pending Issues (Priority Order)

### P0 — Needs User Verification
- **Ecran negru Expo Go**: Fix aplicat (`useSafeTabBarHeight`). User trebuie să testeze pe mobil
- **Badge mesaje necitite grup**: Fix implementat. User trebuie să testeze după deploy
- **Map callout Android**: Custom overlay implementat. User trebuie să testeze tap marker prieten pe Android
- **Date/Time Picker**: Picker nativ implementat. User trebuie să testeze creare/editare eveniment și traseu

### P1 — Known Bugs
- **Eroare pauză traseu**: `PUT /api/routes/pause/{route_id}` — fix aplicat dar NETESTAT
  - Test: `curl -X PUT {API}/api/routes/pause/{route_id} -H "Authorization: Bearer {token}"`
- ~~**MongoDB Atlas Index Conflict**~~: REZOLVAT — crearea indexului făcută idempotentă în `database.py`

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
- `https://mongo-401-errors.preview.emergentagent.com`

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
