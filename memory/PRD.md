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
- Translate remaining components to use i18n keys
### P3 (Future)
- Push notifications
- Payment integration for marketplace
- Premium subscription features
