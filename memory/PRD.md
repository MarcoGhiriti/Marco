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
- **Premium subscription system (Stripe)**

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 (TypeScript)
- **Backend**: FastAPI (Python) - server.py + /routers/
- **Database**: MongoDB (local dev / Atlas production)
- **Map**: Google Maps Platform + react-native-maps-clustering
- **Real-time**: Socket.IO
- **AI**: OpenAI GPT-4o
- **Payments**: Stripe (via emergentintegrations library)

## Language
- Conversations with user: **Romanian**
- UI text / code / errors: **English**

---

## What's Been Implemented

### Sessions 1-8 (Feb-Mar 2026)
- Full auth, friends, routes, events, rides, map, chat, shop, stories, leaderboard system
- See previous PRD versions for full history

### Session 9 (Mar 8, 2026)
- Create Route meeting point section
- Routes Explore with "Created by users" + premium locked card
- Map popup improvements for meeting points and friends

### Session 10 — Premium Subscription System (Mar 17, 2026)
- **Backend: `/app/backend/routers/premium.py`** — Full premium router with:
  - `POST /api/premium/checkout` — Stripe checkout session creation (€4.99/mo)
  - `GET /api/premium/checkout/status/{session_id}` — Payment status polling
  - `POST /api/webhook/stripe` — Stripe webhook handler
  - `GET /api/premium/status` — Premium status check
  - `GET /api/premium/bike` + `PUT /api/premium/bike` — Your Bike CRUD
  - `GET /api/premium/maintenance-tips` — 8 predefined motorcycle maintenance tips
  - `POST /api/premium/free-ride/start|pause|resume|end` — Free Ride mode
  - `GET /api/premium/free-ride/active|history` — Ride tracking
  - `GET /api/premium/recommendations` — 3 route recommendations
  - `POST /api/premium/recommendations/refresh` — New recommendations
  - MongoDB collections: `payment_transactions`, `bike_data`, `free_rides`
- **Frontend Premium Pages:**
  - `/app/frontend/app/premium/index.tsx` — Premium dashboard (subscribe or feature list)
  - `/app/frontend/app/premium/your-bike.tsx` — YourBike with smart alerts, status cards, mileage, edit form
  - `/app/frontend/app/premium/free-ride.tsx` — Full-screen ride tracking (speed, distance, timer)
  - `/app/frontend/app/premium/recommendations.tsx` — 3 route recommendation cards with refresh
  - `/app/frontend/app/premium/maintenance.tsx` — 8 maintenance tip cards
  - `/app/frontend/app/premium/success.tsx` — Payment success with polling
- **Profile Integration:**
  - "MotoGO Premium" card in profile page linking to `/premium`
  - Replaced old "COMING SOON" section with live €4.99/mo card

---

## Pending Issues

### P1 — Previous Session Bugs (Unverified)
- Location search autocomplete in Create Route
- Map Callout/Popup bugs (Android)
- Shop Chat system verification

### P2
- Backend refactor: server.py still has ~4500 lines
- Pause route error
- Recenter button visibility

### Blocked
- Forgot Password: needs email service API key

---

## Upcoming Tasks
- **Chat Route Sharing**: "+" button in group chat to share route cards
- **Route Recommendations in Routes page**: Unlock for premium users (currently in /premium)
- **Full E2E testing** of premium flow on device

## Test Credentials
- User 1 (Premium Activated): `user1@example.com` / `Password123`

## API Base URL
- `https://search-suggestions.preview.emergentagent.com`

## Key API Endpoints (Premium)
- `GET /api/premium/status`
- `POST /api/premium/checkout`
- `GET /api/premium/checkout/status/{session_id}`
- `POST /api/webhook/stripe`
- `GET /api/premium/bike` | `PUT /api/premium/bike`
- `GET /api/premium/maintenance-tips`
- `POST /api/premium/free-ride/start|{id}/pause|{id}/resume|{id}/end`
- `GET /api/premium/free-ride/active|history`
- `GET /api/premium/recommendations`
