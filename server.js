const express = require('express');
const cors = require('cors');
const { pool, setupDB } = require('./db');
const { rateLimit } = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const app = express();
// Prevent oversized payloads
app.use(express.json({ limit: '10kb' }));

// Set up public static files

app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      // versioned bundle: cache long, bust on release
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Basic auth middleware
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE token = $1', [token]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 1. Widget Management API
app.post('/api/widgets', authMiddleware, async (req, res) => {
  const { title, description, fields, button_text } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  
  const id = crypto.randomBytes(8).toString('hex');
  try {
    const { rows } = await pool.query(
      'INSERT INTO widgets (id, user_id, title, description, fields, button_text) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, req.user.id, title, description, JSON.stringify(fields), button_text]
    );
    
    const widget = rows[0];
    const baseUrl = process.env.BASE_URL || \`http://\${req.get('host')}\`;
    widget.embed_snippet = \`<script src="\${baseUrl}/widget.js?id=\${widget.id}"></script>\`;
    
    res.status(201).json(widget);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

app.get('/api/widgets', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM widgets WHERE user_id = $1', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

// 2 & 3. Config Endpoint (public, cached, CORS)
app.get('/widgets/:id/config', cors(), async (req, res) => {
  // short-lived cache for config
  res.setHeader('Cache-Control', 'public, max-age=300');
  try {
    const { rows } = await pool.query('SELECT id, title, description, fields, button_text FROM widgets WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Widget not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submission Rate Limiting
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Geo Enrichment Helpers
const fetchGeo = async (ip) => {
  // If local, return early
  if (ip === '127.0.0.1' || ip === '::1') return { country: 'Local', city: 'Local' };
  
  try {
    // Provider A: ip-api.com
    const resA = await fetch(\`http://ip-api.com/json/\${ip}\`);
    const dataA = await resA.json();
    if (dataA.status === 'success') {
      return { country: dataA.country, city: dataA.city };
    }
    throw new Error('Provider A failed');
  } catch (errA) {
    try {
      // Provider B: ipapi.co
      const resB = await fetch(\`https://ipapi.co/\${ip}/json/\`);
      const dataB = await resB.json();
      if (dataB.country_name) {
        return { country: dataB.country_name, city: dataB.city };
      }
      throw new Error('Provider B failed');
    } catch (errB) {
      // Degrade gracefully
      return { country: null, city: null };
    }
  }
};

// Safe Side Effect Helper
const triggerSideEffect = async (submissionId) => {
  try {
    // Simulate webhook/email that might fail
    if (Math.random() < 0.1) throw new Error('Simulated side effect failure');
    console.log(\`[Side Effect] Successfully processed side effect for submission \${submissionId}\`);
  } catch (err) {
    console.error(\`[Side Effect Error] Failed for submission \${submissionId}, but main flow continues.\`);
  }
};

// 4 & 5. Public Submission Endpoint
app.post('/submissions', cors(), submissionLimiter, async (req, res) => {
  const { widget_id, data, _honeypot } = req.body;
  
  // Basic validation
  if (!widget_id || !data) {
    return res.status(400).json({ error: 'widget_id and data are required' });
  }

  // Spam control: honeypot
  if (_honeypot) {
    // Silently drop it to confuse bots
    return res.status(200).json({ success: true });
  }

  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Validate widget exists
    const widgetRes = await pool.query('SELECT user_id FROM widgets WHERE id = $1', [widget_id]);
    if (widgetRes.rows.length === 0) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    const userId = widgetRes.rows[0].user_id;

    // Enrichment
    const geo = await fetchGeo(ip);

    // Store
    const insertRes = await pool.query(
      'INSERT INTO submissions (widget_id, user_id, data, ip_address, geo_country, geo_city) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [widget_id, userId, JSON.stringify(data), ip, geo.country, geo.city]
    );
    const submissionId = insertRes.rows[0].id;

    // Side effect (never blocks response)
    triggerSideEffect(submissionId);

    res.status(201).json({ success: true, id: submissionId });
  } catch (err) {
    console.error(err);
    // Never 500 on user input, but this could be a DB error.
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Dashboard Endpoints
app.get('/api/submissions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM submissions WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Start server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    await setupDB();
    console.log(\`Server listening on port \${PORT}\`);
  });
}

module.exports = app;

