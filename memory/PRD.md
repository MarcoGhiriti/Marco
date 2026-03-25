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
- Ecran nou frontend: `/auth/google-callback` pentru finalizarea reală a sesiunii Google Login
- Google Login direct fără Emergent începe acum din `/api/auth/google/start` și redirecționează direct către Google OAuth
- Backend folosește Google OAuth client ID/secret din `.env` și emite JWT propriu pentru app
- Compatibilitate adăugată pentru flow-ul vechi Google Login:
  - `GET /api/auth/google-callback`
  - `GET /api/auth/google-pending`
  - `POST /api/auth/google/pending-session`
- Username-ul la Google Login este derivat acum din numele Google (sanitizat, unic)
- Stripe eliminat din backend și din UI-ul principal Premium
- Endpoint nou: `GET /api/premium/payments/status`
- Endpoint-urile Stripe vechi returnează `410 Gone`
- `react-native-maps` Callout eliminat pentru event/gas/service/police popups
- `newArchEnabled` setat la `false` în `frontend/app.json` pentru stabilitate Android
- Pachetul Python `stripe` dezinstalat din backend
- Your Bike are acum card de preview pentru motocicletă
- Free Ride folosește hartă interactivă pe native și fallback sigur pe web
- History arată preview-uri de traseu și modal cu detalii pentru free rides
- Profile are blocurile Premium și Personal Stats mutate mai sus
- Logout reparat fără erorile din notifications/router
- Shop păstrează doar taburile `New` și `Second Hand`
- Butonul Account din dreapta sus deschide acum o pagină separată Marketplace Account
- Marketplace Account include `Seller tools` și inbox pentru conversațiile cumpărătorului
- Hartă Android APK întărită special pentru release:
  - Android folosește `MapView` în loc de `ClusteredMapView`
  - `initialRegion` în loc de `region` controlat pe Android
  - markere simplificate pe Android
  - `tracksViewChanges={false}` aplicat larg
  - limită de markere pe Android pentru stabilitate
  - iOS păstrează comportamentul mai bogat cu clustering și markere custom
- Android are acum și callout-uri native simple pentru toate categoriile principale de markere
- iOS păstrează popup-uri bogate separate de varianta Android-safe
- Mod Android ultra-safe adăugat pentru APK:
  - callout-uri native doar cu `title/description`
  - fără custom map style pe Android
  - locația userului prin `showsUserLocation`
  - route/live ride OFF implicit pe Android
  - limită markere Android = 8, friends = 6

## Verificare făcută
- Iteration 13 testing: PASS
- Iteration 14 testing: PASS
- Iteration 15 testing: PASS
- Verificare UI logout + Shop Account: PASS
- Iteration 17 code review map stability: PASS
- Iteration 18 Android native callouts + iOS overlays: PASS
- Iteration 19 Android ultra-safe APK hardening: PASS
- Backend Google direct start endpoint: PASS (`/api/auth/google/start` -> 302 către Google)
- Backend verificat:
  - `/api/auth/login` 200
  - `/api/auth/google` 401 pentru session invalid (endpoint funcțional)
  - `/api/auth/google-callback` 200 HTML
  - `/api/premium/payments/status` 200
  - `/api/premium/checkout` 410
- Frontend web smoke test: PASS pe `/auth/login`

## P0 rezolvate / în progres
- Google login raw `{"detail":"Not Found"}`: REZOLVAT prin callback compatibil
- Google Login session callback în aplicație: REZOLVAT și verificat
- Emergent Google Auth înlocuit în frontend cu start direct Google OAuth; validarea finală depinde de configurarea redirect-urilor în Google Cloud Console
- Logout mobile/web: REZOLVAT
- Buyer conversations mutate din tab Shop într-o pagină separată accesată din butonul Account
- Android APK map ANR: FIX dedicat implementat în cod, necesită build nou pentru validare pe device
- Android callouts + iOS rich popups: IMPLEMENTAT separat pe platforme
- Android APK hardening stage 2/extreme: IMPLEMENTAT, necesită build nou pentru validare pe device
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