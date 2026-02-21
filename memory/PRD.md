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
- **Route Control Panel** with Start/End/Pause/Directions buttons

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
- **Control Panel for "My Routes"** (21 Feb 2025):
  - Start/End/Pause/Directions buttons
  - Conditional visibility: End/Pause/Directions only after ride started
  - Pre-start validations: min 3 participants, max 3km from start point
  - Active/Paused ride badge on route card
  - Fixed infinite loading bug on Routes page

## 3rd Party Integrations
- OpenAI GPT-4o (via Emergent LLM key) - AI license verification
- Google Maps Platform - Interactive maps, directions, static map proxy
- Socket.IO - Real-time messaging
- react-native-maps-clustering - Map marker clustering

## Prioritized Backlog
### P0 (Critical) - NONE
### P1 (Important)
- Update "Ride in Progress" popup with Directions/End buttons
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

### Session Log - February 17, 2026 (Update)

### Bug Fixes Completed
1. **Feed "Couldn't load feed" Bug** - Fixed error parsing in `/app/frontend/src/lib/api.ts` to properly extract `detail` field from JSON error responses. Previously, the error message displayed raw 403 responses including full JSON.

2. **Alert Not Working on Web** - Created cross-platform `showAlert()` helper function in `home.tsx` that uses `window.alert()` on web and native `Alert.alert()` on mobile. This fixes the silent failure when trying to join routes with insufficient CC.

3. **401 Unread Summary Error** - Fixed `unreadStore.ts` to silently catch 401 errors when fetching unread messages. The error no longer appears in the UI error state.

4. **Home Routes Filter (100km)** - Changed radius filter from 500km to 100km for route discovery on home screen.

### Files Modified (This Update)
- `/app/frontend/src/lib/api.ts` - Fixed error parsing in `apiGet`, `apiPost`, `apiPut` functions
- `/app/frontend/app/(tabs)/home.tsx` - Added `showAlert()` helper, replaced `Alert.alert` calls, changed radius to 100km
- `/app/frontend/src/state/unreadStore.ts` - Added try-catch to silently handle auth errors
- `/app/frontend/app/auth/login.tsx` - Added `data-testid="login-submit-btn"` for testing

