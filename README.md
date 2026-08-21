# Embeddable Widget & Lead-Capture Platform

## Architecture
A multi-tenant widget platform allowing customers to embed lead-capture widgets.
It uses Node.js, Express, and PostgreSQL.

\`\`\`
Widget Owner (authenticated) -> /api/widgets -> DB
Customer Website -> /widgets/:id/config & /widget.js (Cached)
Visitor -> /submissions -> Validation -> Rate Limiter -> Spam Check -> Geo Enrichment -> Store -> Side Effect
\`\`\`

## Setup
1. Copy \`.env.example\` to \`.env\`
2. Run database: \`docker compose up -d\`
3. Install dependencies: \`npm install\`
4. Run server: \`npm start\`
5. Open \`customer-site/index.html\` to view the widget.

## Seeding Demo Data
To seed data, simply run \`npm start\` (it automatically creates tables on start) and hit \`POST /api/widgets\` with auth header \`Bearer supersecret_dev_key\` (make sure to insert a user in the DB first).

## Limitations
- This is a backend capstone prototype. The frontend is minimal.
- Basic auth token used for simplicity; a real system would use OAuth or JWT.
- Email side effect is simulated by a log.
