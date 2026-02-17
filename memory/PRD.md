# MotoGO - Product Requirements Document

## Original Problem Statement
MotoGO is a React Native (Expo) motorcycle social app with FastAPI + MongoDB backend. Features include routes, events, marketplace, interactive map, friends system, groups, stories, rides/badge tracking, and user profiles.

## Core Requirements
- User auth (JWT-based)
- Route creation & tracking with Google Maps
- Event management
- Marketplace for motorcycle gear
- Interactive map with gas stations, service, events
- Friends system with messaging (Socket.IO)
- Group chat
- Stories (time-limited)
- Ride tracking with km logging
- Badge/level system
- User profiles with privacy settings
- AI license verification (GPT-4o via Emergent LLM key)

## User Personas
- Romanian motorcycle riders
- Primary language: Romanian (with English support)

## Architecture
```
/app
├── backend/
│   ├── server.py         # Main API routes (FastAPI + Socket.IO)
│   ├── database.py       # NEW: Shared DB connection, helpers, indexes
│   ├── src_auth.py       # Auth utilities
│   └── src_chat_models.py # Chat/message models
└── frontend/
    ├── app/              # Expo Router pages
    │   ├── (tabs)/       # Tab navigation (home, routes, map, events, shop)
    │   ├── profile/      # Profile screens ([id], edit, friends, etc.)
    │   └── auth/         # Login/register
    └── src/
        ├── lib/i18n.ts   # i18next config (EN + RO)
        ├── locales/      # en.json, ro.json
        ├── components/   # Shared components
        ├── state/        # Zustand stores
        └── theme/        # Colors, fonts
```

## What's Been Implemented
- Full auth (login/register)
- Routes CRUD with Google Maps integration
- Events CRUD
- Marketplace with listings
- Interactive map (Map V2) with filters, directions, event markers, user location
- Friends system with requests, accept, reject, remove
- Group chat with Socket.IO
- Stories with TTL
- Ride tracking with km logging
- Badge/level system (15 badge types)
- Universal user profiles (clickable avatars throughout app)
- Privacy settings (location, km, last_active visibility)
- Backend image proxy for static maps
- i18n (English + Romanian) with language switcher
- Backend optimization: database.py module, MongoDB indexes, connection pooling (maxPoolSize=100)
- Marketplace padding optimization

## 3rd Party Integrations
- OpenAI GPT-4o (via Emergent LLM key) - AI license verification
- Google Maps Platform - Interactive maps, directions, static map proxy
- Socket.IO - Real-time messaging
- react-native-maps-clustering - Map marker clustering

## Prioritized Backlog
### P0 (Critical) - NONE
### P1 (Important)
- Further backend refactoring: Split server.py into separate APIRouter files
### P2 (Nice to have)
- Forgot Password flow (BLOCKED - needs email service API key)
- Translate remaining modal texts and level titles to Romanian
### P3 (Future)
- Push notifications
- Payment integration for marketplace
- Premium subscription features

## Session Log - February 17, 2026

### Completed
1. **Duration Format** - Implemented `formatDuration()` in `/app/frontend/src/lib/utils.ts` to convert route durations (e.g., 90 min → 1h 30min)
2. **Directions Button** - Added "Direcții" button in `RouteCard.tsx` for route creators with active rides. Opens Google Maps with route directions.
3. **Profile Route Deletion Bug Fix** - Added `useFocusEffect` hook in `profile.tsx` to refresh data when screen regains focus, preventing stale data after route deletion.
4. **Romanian Translations** - Updated all difficulty labels (Ușor/Mediu/Greu), Join/Joined buttons (Inscrie-te/Inscris), and added `directionsBtn` style.
5. **Fixed Syntax Error** - Corrected StyleSheet array syntax in `routes.tsx` that was causing Metro bundling failure.
6. **CC Error Messages** - Added friendly alert messages in Romanian when user can't join a route due to engine size requirements (cc). Two cases: minimum cc not met, or bike not configured.
7. **Custom Map Style** - Enhanced interactive map with a unique dark theme focused on motorcycle riding: highlighted highways with accent glow, subtle terrain, cleaner labels.
8. **Chat Badge for Unread Messages** - Added chat button with unread indicator (green dot) in the Home screen header. Badge appears when user has unread messages.

### Files Modified
- `/app/frontend/src/lib/utils.ts` - `formatDuration()` and `openDirectionsInGoogleMaps()` functions
- `/app/frontend/src/components/RouteCard.tsx` - Directions button, i18n translations, `directionsBtn` style
- `/app/frontend/src/components/MapCanvas.native.tsx` - New custom MAP_STYLE with motorcycle-focused design
- `/app/frontend/app/(tabs)/routes.tsx` - Fixed StyleSheet syntax, i18n for difficulty badges
- `/app/frontend/app/(tabs)/home.tsx` - Added CC error handling with i18n alerts
- `/app/frontend/app/(tabs)/profile.tsx` - `useFocusEffect` for data refresh, level translation
- `/app/frontend/src/locales/en.json` - Added `maxLevel`, `ccRequired`, `ccRequiredMessage`, `bikeNotConfigured`, `bikeNotConfiguredMessage` keys
- `/app/frontend/src/locales/ro.json` - Complete Romanian translations for new keys

### Testing
- Code review verification passed (iteration_8.json)
- API health check: OK
- Frontend bundling: OK
- Visual verification: Login screen renders correctly

