## Moto GO PRD (living)

### Implemented
- Marketplace (Second Hand): listing creation, detail page, contact actions (Message/Call), owner delete, and My Listings page.
- Optional phone field for listings (frontend + backend).
- Marketplace backend filters: `mine=true` and 3‑month listing limit; phone included in responses.
- Map screen update (native): event markers toggle + Report Police FAB.
- Custom map styling (dark + neon accents) on native.
- Map filters: Events + Gas/Service chips, recenter, Search this area.
- Police reports: confirm flow, TTL 30 min, voting (Still there?) with distance check.
- Marker clustering for map layers.
- Map screen header actions: add Route + add Event.
- Mini‑map: MapView pe native (străzi reale), fără grid.

### In Progress / Needs Retest
- Marketplace UI: listing click error fix (null kilometers safeguard) — needs UI retest.
- Map screen: MapCanvas split (native/web) + Expo Go recursion fix — needs device retest.
- Mini‑map MapView (native) — needs device retest.
- Map filters + police report flow + clustering — needs device retest.

### Backlog / Upcoming
- Mini‑map styling: show adjacent streets in gray.
- Map screen simplification: only “Report Police”.
- Event markers on map with toggle.
- i18n RO/EN + language switcher.
- Backend refactor: split monolithic server.py into routers.
- Forgot Password flow (blocked on email provider keys).
