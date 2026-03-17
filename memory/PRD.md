# MotoGO - PRD

## Session 10-12 Premium System + Chat Route Sharing

### Latest Changes (Session 12)

**Chat Route Sharing (Group Chat)**
- "+" button added next to message input in group chat
- Two options: "Create Route" (navigates to route creation) + "Share Route" (opens route picker modal)
- Route picker loads user's routes from `/api/routes/my`, shows them as cards
- Selecting a route sends a formatted message `[Route] Title - Start > End (X km)` to the group chat
- Files: `frontend/app/community/group/[groupId].tsx`

**Premium Badge** - Expanded across app
- `PremiumBadge` component (`/frontend/src/components/PremiumBadge.tsx`) - green circle with motorcycle icon
- Added in:
  - Profile page (next to username)
  - Friends list (next to friend name)
  - Group chat member list (via `GroupMember.premium` field)
- Backend changes:
  - `UserPublic` model: added `premium: bool = False`
  - `UserSearchOut` model: added `premium: bool = False`
  - `/api/friends` endpoint: now returns `premium` field
  - `/api/me` endpoint: returns `premium` field

### All Premium Features Implemented
- Stripe Checkout (€4.99/mo)
- Premium Dashboard with 5 feature cards
- YourBike (insurance/ITP/service tracking)
- Free Ride Mode (live map + stats + summary with polyline + stop checkpoints)
- AI Route Generator (Google Directions API)
- Ride History (route participations + free rides)
- Maintenance Tips (8 tips)
- Route Recommendations (3 picks + refresh)
- Chat Route Sharing (+ button in group chat)
- Premium Badge (profile, friends, chat)

### Pending
- Backend refactor (server.py ~4500 lines)
- Forgot Password flow
- Location search autocomplete fix (from previous session)
- Map Callout/Popup bugs (from previous session)

### Test Credentials
- User 1 (Premium Active): `user1@example.com` / `Password123`
