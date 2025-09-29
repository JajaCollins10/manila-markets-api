// File: server/setup_admins.js

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// --- MODIFIED: Added SSL configuration ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const setupAdmins = async () => {
  console.log('Starting admin setup script (simplified)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop the old table if it exists to apply the new column name
    await client.query('DROP TABLE IF EXISTS admins CASCADE;');

    console.log('Creating "admins" table...');
    await client.query(`
      CREATE TABLE admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating default admin user...');
    await client.query(
      `INSERT INTO admins (username, password, full_name) VALUES ($1, $2, $3)`,
      ['admin', 'password123', 'Administrator']
    );
    console.log('Default admin created with username "admin" and password "password123".');
    
    await client.query('COMMIT');
    console.log('✅ Admin setup completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during admin setup:', error);
  } finally {
    client.release();
    pool.end();
  }
};

setupAdmins();