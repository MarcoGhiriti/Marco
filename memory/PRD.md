# MotoGO - PRD (Updated Mar 17, 2026)

## Session 10-11 Updates

### AI Route Generator (Routes Page)
- Premium users see "AI Route Generator" in Explore tab (replaces locked card)
- Input: desired km + current location -> Google Directions API generates loop route
- Share button copies route info to clipboard
- Non-premium users see locked premium card

### Free Ride km -> Stats
- `km_total` + `km_month` updated on free ride end (was only `total_km` before)

### Ride History (Premium)
- `/premium/history` page with 2 tabs: Routes + Free Rides
- Routes tab: participated route rides with km tracked
- Free Rides tab: free rides with distance, max speed, duration, stops
- Added to Premium Dashboard feature list

### Backend New Endpoints
- `POST /api/premium/generate-route` - AI route generation via Google Directions
- `GET /api/premium/history/routes` - Route participation history
- `GET /api/premium/history/free-rides` - Detailed free ride history with polylines
- `POST /api/premium/free-ride/{id}/location` - Live location update during ride

### Files Modified
- `/app/backend/routers/premium.py` - Added 5 new endpoints
- `/app/frontend/app/(tabs)/routes.tsx` - AI route generator for premium, share button
- `/app/frontend/app/premium/index.tsx` - Added Ride History to feature list
- `/app/frontend/app/premium/history.tsx` - NEW: History page

### Pending for next session
- Free Ride live map tracking (Google Maps tracking API on map during ride)
- Free ride final summary with polyline + stop checkpoints on map
- Chat Route Sharing
