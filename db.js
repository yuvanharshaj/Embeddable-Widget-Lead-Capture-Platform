const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const setupDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        token VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS widgets (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255),
        description TEXT,
        fields JSONB,
        button_text VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        widget_id VARCHAR(50) REFERENCES widgets(id),
        user_id INTEGER REFERENCES users(id),
        data JSONB,
        ip_address VARCHAR(50),
        geo_country VARCHAR(100),
        geo_city VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables verified/created');
  } catch (err) {
    console.error('Error setting up DB', err);
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  setupDB
};
