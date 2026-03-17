# MotoGO PRD - Updated Mar 17, 2026

## Latest: AI Route Save/Start + Saved Routes Page

### Route Generator Enhanced
- Returns: `curves_count`, `avg_speed_kmh`, `has_highways`, `has_urban_areas`, `waypoints_nav`
- Round-trip routes (origin = destination) with 6 waypoint stops
- Cards show: polyline map, difficulty badge, start/end cities, stats chips

### Save + Start Buttons
- **Save**: Saves generated route to `saved_routes` MongoDB collection
- **Start**: Opens Google Maps with full waypoint navigation (round trip URL)

### Saved Routes Page (`/premium/saved-routes`)
- List all saved routes with difficulty, km, curves, progress%
- Full-screen detail view with: polyline map, stats grid (km/min/avg speed/curves), Highway/Urban/Round Trip tags
- Start in Google Maps button, Mark Complete button, Delete
- Progress tracking (progress_pct field)

### New Backend Endpoints
```
POST   /api/premium/saved-routes           - Save generated route
GET    /api/premium/saved-routes           - List saved routes  
GET    /api/premium/saved-routes/{id}      - Route detail
POST   /api/premium/saved-routes/{id}/start    - Mark as active
POST   /api/premium/saved-routes/{id}/progress - Update %
POST   /api/premium/saved-routes/{id}/complete - Mark complete
DELETE /api/premium/saved-routes/{id}      - Delete route
```

### Files
- `/app/backend/routers/premium.py` - 7 new endpoints + enhanced generate-route
- `/app/frontend/app/premium/saved-routes.tsx` - NEW page
- `/app/frontend/app/premium/index.tsx` - Added Saved Routes feature card
- `/app/frontend/app/(tabs)/routes.tsx` - Save/Start/Refresh buttons on generated card

### Test: user1@example.com / Password123 (Premium Active)
