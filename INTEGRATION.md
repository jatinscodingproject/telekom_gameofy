# Telkom PartnerHUB integration — how it works

## 1. Architecture

```
Browser ──► /api/subscribe/start ──► subscriptionService ──► telkomClient (SigV4) ──► PartnerHUB API
   ▲                                        │  ▲
   │ 302 to Consent Gateway                 ▼  │
   │                                   MySQL: subscriptions / billings / callback_events
   │                                        ▲
PartnerHUB ──► POST /api/callbacks/subscription/<token>   (Reason: ACTIVATED|SUSPENDED|EXPIRED|CANCELLED|DOI_FAILED)
           ──► POST /api/callbacks/billing/<token>
           ──► browser GET /consent/return?msisdn=..&ext_ref=..   (after consent; informational only)
```

**Golden rule: only a server-to-server callback (or a `GET /subscription/{id}` reconcile) can activate a user.**
The browser returning from the Consent Gateway proves nothing and never grants access.

## 2. The flows

### A. CLICK flow (MSISDN known from network header)
1. User taps SUBSCRIBE → `POST /api/subscribe/start`.
2. Server reads the MSISDN header (`MSISDN_HEADERS`), creates a local `PENDING` row with a fresh `ext_ref`.
3. Server calls `POST /subscription {msisdn, svc_id, ext_ref, channel:"WAP", doi_channel:"WAP"}`.
4. Telkom answers `200` with the pending subscription + header `API-WAP-DOI-Location` (consent URL).
5. Browser is redirected to that URL, user confirms on the Telkom page.
6. Telkom sends `ACTIVATED` callback → row becomes `ACTIVE`; Telkom sends the Welcome SMS itself.
7. Browser lands on `/consent/return`, which polls `/api/subscribe/status` until `entitled:true`, then sets `gf_session`.

### B. WI-FI / direct-redirect flow (no MSISDN)
1. `POST /api/subscribe/start` finds no MSISDN → creates a local `PENDING` row (`msisdn = NULL`, `flow = WIFI`).
2. Browser goes straight to `https://sdp-?-vas-payment.telkom.co.za/service/{svc_id}?ext_ref={ours}` (no REST call).
3. Gateway detects the number by header enrichment on mobile data, or sends an **OTP** on Wi-Fi.
4. User consents → Telkom sends `ACTIVATED` callback containing our `ext_ref` → matched to the pending row, MSISDN filled in.
5. Same polling page as above.

### C. SMS-DOI flow (optional, `ALLOW_SMS_DOI=true`)
Typed number → `POST /subscription` with `doi_channel:"SMS"` → user confirms by SMS → `ACTIVATED` callback.
"Resend" button calls `PATCH /subscription/{id}/doi`.

### D. Ad hoc billing (admin/server only)
`POST /api/telkom/billing/ad-hoc` (header `x-admin-key`) → `POST /billing/ad-hoc`. Stores a `billings` row (`SCHEDULED`, -5300).
DOI events arrive on the **subscription** callback with `billing_cycle=ONCE` → stored as `is_ad_hoc` (never entitles content).
The billing callback later flips the same row to `SUCCESS`.

### E. Cancellation
`POST /api/subscribe/cancel` (session required) → `DELETE /subscription/{id}`. Telkom sends the cancellation SMS and a `CANCELLED` callback.

## 3. Callback handling (what makes it reliable)
| Situation | Behaviour |
|---|---|
| Telkom retries (no 2xx for 30 min × 12) | Event saved in `callback_events` first; identical event = `200 {duplicate:true}` |
| Our DB is down | `500` → Telkom retries later; nothing is lost |
| Old event arrives after a newer one (e.g. SUSPENDED after CANCELLED) | Stored, `process_result=stale_event/illegal_transition`, state unchanged, still `200` |
| Subscription we never created (Telkom portal sign-up, no `ext_ref`) | Row created, `flow=EXTERNAL` |
| Billing callback | Upsert by `billing_ref`; only refreshes dates; **never changes subscription status** |
| `status_id` | Ignored (PDF table contradicts its own examples) — `Reason` header, then `status_name` |
| Lost callbacks | `jobs/reconcile.js` every 10 min: syncs old `PENDING`, abandons after 24 h, re-verifies silent `ACTIVE` |

## 4. What you must give / ask Telkom
1. **Callback URLs** (per service): `https://<domain>/api/callbacks/subscription/<CALLBACK_TOKEN>` and `/api/callbacks/billing/<CALLBACK_TOKEN>`
2. **DOI return URL** for the service: `https://<domain>/consent/return`
3. **Your server's outbound public IP(s)** — API only accepts whitelisted IPs.
4. Ask them for: callback source IPs (`TELKOM_CALLBACK_IPS`), the real MSISDN header name, the exact consent-gateway host, and the **query parameters sent to the return URL** (PDF only names `msisdn` and `ext_ref`).

## 5. Running & testing
```bash
cp .env.example .env      # fill values, keep TELKOM_ENV=staging
npm install
npm test                  # 28 tests: signing vs AWS vector, state machine, all flows end-to-end
npm run mock:telkom       # fake PartnerHUB on :4999 (set TELKOM_BASE_URL_OVERRIDE in .env)
npm run dev
# simulate the user confirming:
curl -X POST localhost:4999/_simulate -H 'content-type: application/json' -d '{"subscription_id":111,"reason":"ACTIVATED"}'
```
The DB schema upgrades itself on start (`scripts/migrate.js`, adds columns, never drops data).
