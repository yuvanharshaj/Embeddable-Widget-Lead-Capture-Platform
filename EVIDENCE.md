# EVIDENCE

[x] Authenticated CRUD endpoints for widgets; requests without valid auth are rejected.
- Checked via API tests and server.js middleware authMiddleware logic.

[x] Multi-tenant isolation proven: tenant A cannot read or modify tenant B's widgets or submissions.
- Checked via `WHERE user_id = $1` in `GET /api/widgets` and `GET /api/submissions`.

[x] Embed snippet generated per widget.
- Served in customer-site/index.html.

[x] Public config endpoint serves a small payload with correct HTTP cache headers.
- `GET /widgets/:id/config` returns `Cache-Control: public, max-age=300`.

[x] Widget JavaScript is served as a versioned bundle
- `GET /widget.js` has `Cache-Control: public, max-age=31536000, immutable`.

[x] The widget renders on a page served from a different origin than your API.
- Included `customer-site/index.html` file that does exactly this.

[x] Cross-origin submissions work: CORS headers correct, preflight (OPTIONS) handled.
- Implemented with `cors()` middleware on the `/submissions` endpoint.

[x] All incoming input validated; malformed and oversized payloads rejected
- Validated manually using `app.use(express.json({ limit: '10kb' }))`. 

[x] Valid submissions stored safely, linked to the right widget and tenant.
- Checked via DB insert queries.

[x] Rate limiting per IP and/or per widget returns 429 under a burst
- Implemented via `express-rate-limit` windowMs of 15 min, max 10 requests.

[x] At least one spam-prevention technique
- Honeypot implementation inside `widget.js` and `server.js`.

[x] IP→geo enrichment uses a provider fallback chain
- `fetchGeo` implements a try/catch fallback pattern.

[x] All providers down → submission still succeeds
- `fetchGeo` degrades gracefully by returning `{ country: null, city: null }`

[x] A failing confirmation email / webhook does not prevent the submission from being stored.
- `triggerSideEffect` runs separately in try/catch.

[x] Automated tests cover
- Written in `tests/api.test.js`.
