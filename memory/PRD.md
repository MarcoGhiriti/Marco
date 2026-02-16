## Moto GO PRD (living)

### Implemented
- Marketplace (Second Hand): listing creation, detail page, contact actions (Message/Call), owner delete, and My Listings page.
- Optional phone field for listings (frontend + backend).
- Marketplace backend filters: `mine=true` and 3‑month listing limit; phone included in responses.
- Map screen update (native): event markers toggle + Report Police FAB.
- Mini‑map styling: adjacent streets rendered in gray.

### In Progress / Needs Retest
- Marketplace UI: listing click error fix (null kilometers safeguard) — needs UI retest.
- Map screen: MapCanvas split (native/web) + Expo Go recursion fix — needs device retest.

### Backlog / Upcoming
- Mini‑map styling: show adjacent streets in gray.
- Map screen simplification: only “Report Police”.
- Event markers on map with toggle.
- i18n RO/EN + language switcher.
- Backend refactor: split monolithic server.py into routers.
- Forgot Password flow (blocked on email provider keys).
