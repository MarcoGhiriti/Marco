# MotoGO - PRD

## Session 10-11 Premium System

### Implemented Features

**Stripe Integration** (€4.99/mo)
- Checkout, payment polling, webhook handler
- Collections: `payment_transactions`, `bike_data`, `free_rides`

**Premium Dashboard** (`/premium`)
- Feature cards: YourBike, Free Ride, History, Recommendations, Maintenance Tips
- Subscribe/Active state with feature unlock

**YourBike** (`/premium/your-bike`)
- Insurance/ITP/Service tracking with smart alerts
- Mileage card + edit form

**Free Ride Mode** (`/premium/free-ride`) - UPDATED
- Live map: Google Static Map refreshing every 10s showing position + polyline trail
- Live stats panel: timer, speed, distance, max speed
- Pause/Resume with stop checkpoint recording
- Summary screen: full polyline on map + stops legend + stat cards + done button
- km added to `km_total` + `km_month` on ride end

**AI Route Generator** (Routes page)
- Premium users: input km -> Google Directions API generates loop route
- Share button (copies to clipboard)
- Non-premium: locked premium card

**Ride History** (`/premium/history`)
- Tab: Route participations (from ride_sessions)
- Tab: Free rides (distance, speed, duration, stops)

**Maintenance Tips** (`/premium/maintenance`)
- 8 predefined motorcycle care tips

**Premium Badge**
- `PremiumBadge` component with motorcycle icon
- Shown in Profile next to username
- `premium` field added to UserPublic model

### All Premium Backend Endpoints
```
POST /api/premium/checkout
GET  /api/premium/checkout/status/{session_id}
POST /api/webhook/stripe
GET  /api/premium/status
GET  /api/premium/bike
PUT  /api/premium/bike
GET  /api/premium/maintenance-tips
POST /api/premium/free-ride/start
POST /api/premium/free-ride/{id}/pause
POST /api/premium/free-ride/{id}/resume
POST /api/premium/free-ride/{id}/end
POST /api/premium/free-ride/{id}/location
GET  /api/premium/free-ride/active
GET  /api/premium/free-ride/history
GET  /api/premium/recommendations
POST /api/premium/recommendations/refresh
POST /api/premium/generate-route
GET  /api/premium/history/routes
GET  /api/premium/history/free-rides
```

### Pending
- Chat Route Sharing (+ button in group chat)
- Premium badge in more places (friends, map, chat)
- Backend refactor (server.py)
- Forgot Password flow

### Test Credentials
- User 1 (Premium Active): `user1@example.com` / `Password123`
