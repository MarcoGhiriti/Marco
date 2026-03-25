# Emergent Google Auth Testing Notes

## Core flow
- Frontend opens `https://auth.emergentagent.com/?redirect=<dynamic_redirect_url>`
- Redirect returns with `#session_id=...`
- Frontend exchanges `session_id` with `POST /api/auth/google`
- Backend fetches session data from `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`

## Mobile checks
- Use Expo deep link redirect generated with `Linking.createURL(...)`
- Do not hardcode redirect URLs or add fallbacks
- Parse `session_id` from the returned deep link URL fragment
- After exchange, store app JWT and load `/api/me`

## Frontend verification
- Welcome screen Google button starts auth flow
- Login screen Google button starts auth flow
- On success, user lands in `/(tabs)/home`
- No requests go to nonexistent `/api/auth/google-pending`
- No requests go to nonexistent `/api/auth/google-callback`

## Backend verification
- `POST /api/auth/google` returns `{ access_token }`
- Invalid or missing `session_id` returns a clear 4xx error
- `/api/me` works with the returned JWT