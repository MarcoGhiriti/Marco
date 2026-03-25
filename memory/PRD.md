# MotoGO PRD

## Problemă originală
Aplicația MotoGO are nevoie de:
- sistem Premium complet
- Google Login funcțional
- hartă stabilă pe Android
- înlocuirea Stripe cu Apple Pay + Google Pay native

## Arhitectură curentă
- Frontend: Expo / React Native / expo-router
- Backend: FastAPI + MongoDB
- Hărți: Google Maps + react-native-maps
- Auth social: Emergent Google Auth

## Implementat până acum
- Premium foundation, Your Bike, Free Ride, Saved Routes, Polls, i18n, notificări push
- Google Login refăcut pe flow nou Expo (`openAuthSessionAsync` + exchange la `/api/auth/google`)
- Compatibilitate adăugată pentru flow-ul vechi Google Login:
  - `GET /api/auth/google-callback`
  - `GET /api/auth/google-pending`
  - `POST /api/auth/google/pending-session`
- Stripe eliminat din backend și din UI-ul principal Premium
- Endpoint nou: `GET /api/premium/payments/status`
- Endpoint-urile Stripe vechi returnează `410 Gone`
- `react-native-maps` Callout eliminat pentru event/gas/service/police popups
- `newArchEnabled` setat la `false` în `frontend/app.json` pentru stabilitate Android
- Pachetul Python `stripe` dezinstalat din backend

## Verificare făcută
- Iteration 13 testing: PASS
- Iteration 14 testing: PASS
- Backend verificat:
  - `/api/auth/login` 200
  - `/api/auth/google` 401 pentru session invalid (endpoint funcțional)
  - `/api/auth/google-callback` 200 HTML
  - `/api/premium/payments/status` 200
  - `/api/premium/checkout` 410
- Frontend web smoke test: PASS pe `/auth/login`

## P0 rezolvate / în progres
- Google login raw `{"detail":"Not Found"}`: REZOLVAT prin callback compatibil
- Android interactive map crash: MITIGAT prin eliminarea Callout + dezactivarea new architecture
- Stripe removal: REZOLVAT

## P0 rămase
- Integrarea completă Apple Pay + Google Pay native după primirea credentialelor de merchant

## P1
- Verificare / reparare autocomplete pe Create Route
- Confirmare pe device Android că noul build nu mai crapă la hartă

## P2
- Refactor `backend/server.py`
- Forgot password cu provider de email
- Finalizare traduceri rămase pe ecranele Premium

## Date / chei necesare de la utilizator pentru plăți native
- Apple Pay: Merchant Identifier, Key ID, Issuer ID, cheia `.p8`
- Google Pay: package name, product/subscription ID, Merchant ID, service account JSON cu Android Publisher access