# MotoGO - Product Requirements Document

## Original Problem Statement
Social-mapping application for motorcyclists with features for route planning, live location sharing, events, friend management, police reporting, real-time map interactions, group chats, DMs, leaderboard, badges, marketplace, and premium subscription.

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 (TypeScript)
- **Backend**: FastAPI (Python) - server.py + /routers/
- **Database**: MongoDB
- **Payments**: Stripe (via emergentintegrations)
- **Map**: Google Maps Platform
- **Real-time**: Socket.IO
- **AI**: OpenAI GPT-4o

## What's Been Implemented

### Session 10 — Premium System (Mar 17, 2026)
- **Stripe Integration**: Checkout €4.99/mo, payment polling, webhook, payment_transactions collection
- **Backend Router** (`/app/backend/routers/premium.py`): 14 endpoints for checkout, status, bike CRUD, free ride, tips, recommendations
- **6 Frontend Screens**: Premium dashboard, YourBike (smart alerts, insurance/ITP/service), Free Ride (speed/distance/timer), Recommendations (3 cards + refresh), Maintenance Tips (8), Payment Success
- **Profile Integration**: "MotoGO Premium" card with €4.99/mo price, links to /premium
- **Premium Badge**: `PremiumBadge` component (motorcycle icon) shown next to username in Profile
- **UserPublic model**: Added `premium` boolean field to `/api/me` response
- **Bug fix**: timezone-aware vs naive datetime comparison

## Pending
- Chat Route Sharing (+ button in group chat)
- Premium badge in more places (friends list, map, chat)
- Backend refactor (server.py ~4500 lines)
- Forgot Password flow

## Test Credentials
- User 1 (Premium): `user1@example.com` / `Password123`

## Key Premium Endpoints
- `POST /api/premium/checkout` | `GET /api/premium/status`
- `GET /api/premium/checkout/status/{id}` | `POST /api/webhook/stripe`
- `GET|PUT /api/premium/bike` | `GET /api/premium/maintenance-tips`
- `POST /api/premium/free-ride/start|{id}/pause|{id}/resume|{id}/end`
- `GET /api/premium/recommendations` | `POST /api/premium/recommendations/refresh`
