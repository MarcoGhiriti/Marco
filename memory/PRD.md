# MotoGO - PRD (Product Requirements Document)

## Original Problem Statement
MotoGO is a motorcycle social application built with React Native (Expo) frontend and FastAPI + MongoDB backend. The app provides route planning, event management, marketplace, community features, and an interactive map for motorcyclists.

## Core Requirements
- User authentication (JWT-based)
- Route creation/sharing with polyline maps
- Event creation and participation
- Interactive map with gas stations, service points, and route markers
- Marketplace for buying/selling motorcycle gear
- Community features (friends, messaging, groups)
- Stories feature
- License verification (AI-powered via GPT-4o)
- User profiles with privacy controls

## User Personas
- **Rider**: Casual motorcyclist who wants to find routes and events
- **Seller**: User who lists motorcycle gear for sale
- **Community Leader**: User who organizes group rides and events

## Tech Stack
- **Frontend**: React Native (Expo), TypeScript, Expo Router
- **Backend**: FastAPI, Python, Motor (async MongoDB)
- **Database**: MongoDB
- **Maps**: Google Maps Platform (Maps SDK, Static API, Places API)
- **AI**: OpenAI GPT-4o (license verification via Emergent LLM Key)
- **Real-time**: Socket.IO

## What's Been Implemented

### Authentication & User Management
- JWT login/register
- Profile editing (bio, bike, country, photo)
- License upload and AI verification
- Privacy settings (location, km, routes, last active visibility)

### Routes & Events
- Create, view, join routes with polyline maps
- Create, view, join events
- Route/event detail pages with RouteMiniMap (static image via backend proxy)
- Home feed with route/event cards and filter toggles

### Interactive Map (V2)
- ClusteredMapView with dark theme
- Gas station and service point markers with custom callouts
- **Directions button** on gas/service markers → opens Google Maps
- Recenter GPS button
- "Search this area" button
- Route and event markers

### Marketplace
- Second-hand listings with categories, search, filtering
- Create listing modal with multi-step wizard
- Listing detail page
- Seller username shown on listing cards (tappable → profile)
- Reduced padding between categories and listings

### Community
- Friends list, friend requests (send/accept/decline/cancel)
- Direct messages and group chats
- Search users
- Unread message indicators

### Notifications
- Simple notification list (friend requests + system notifications)
- Community button in header (top-right)
- Mark all read functionality
- Friend request actions inline

### Universal User Profile
- Single UserProfileScreen accessible from everywhere
- Relationship-based actions:
  - self → Edit Profile
  - not_friends → Add Friend
  - request_sent → Cancel Request
  - request_received → Accept/Decline
  - friends → Message + Remove Friend
- Profile content: avatar, username, level, bio, bike, country, license, stats
- Privacy-controlled fields respected
- Username/avatar tappable in: marketplace, community, notifications

### Stories
- Create and view stories with photo/video

## API Endpoints (Key)
- POST /api/auth/login, /api/auth/register
- GET/PATCH /api/me
- GET /api/users/{id} (enhanced with relationship + privacy)
- GET/POST /api/routes, /api/events
- GET /api/marketplace/listings, POST /api/marketplace/listings
- GET /api/friends, /api/friends/requests
- POST /api/friends/request, /accept, /reject, /cancel, /remove
- GET /api/notifications, POST /api/notifications/{id}/read
- GET /api/map/static-image (proxy to Google Maps Static API)
- GET /api/map/nearby-places

## Credentials
- User 1: user1@example.com / Password123 (verified license)
- User 2: user2@example.com / Password123 (unverified license)

---

## Prioritized Backlog

### P0 - Completed This Session
- [x] Notifications screen simplified (no tabs) + Community button
- [x] RouteMiniMap fix (width: 100%)
- [x] Marketplace padding reduced
- [x] Map V2: Directions button on gas/service markers
- [x] Universal User Profile with relationship states
- [x] Remove Friend endpoint
- [x] Privacy settings in Edit Profile
- [x] Username/avatar tappable everywhere

### P1 - Next Up
- [ ] Marketplace: "Anunțurile mele" page (view/delete own listings)
- [ ] Community page enhancements

### P2 - Upcoming
- [ ] Marketplace: 3-month listing expiry
- [ ] Internationalization (EN + language switcher)
- [ ] Backend refactor (server.py → separate routers)

### P3 - Backlog
- [ ] "Forgot Password" flow (blocked - needs email API key)
- [ ] Push notifications (native build required)

## Last Updated: 2026-02-16
