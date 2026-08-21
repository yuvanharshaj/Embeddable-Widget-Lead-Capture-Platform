const { pool } = require('./db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO users (username, password, token) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', ['demo', 'pass', 'supersecret_dev_key']);
    console.log('Seed completed successfully.');
  } catch (e) {
    console.error('Seed failed', e);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
