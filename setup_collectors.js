// File: setup_collectors.js

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from your .env file
dotenv.config();

// Set up the database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Main function to run our setup logic
const setupCollectors = async () => {
  console.log('Starting collector setup script...');
  const client = await pool.connect();

  try {
    // Begin a database transaction
    await client.query('BEGIN');

    // Step 1: Create the 'collectors' table if it doesn't already exist.
    // Using "IF NOT EXISTS" makes the script safe to re-run.
    console.log('Creating "collectors" table (if it does not exist)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS collectors (
        id SERIAL PRIMARY KEY,
        collector_id VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Step 2: Insert the sample collector only if they don't already exist.
    // "ON CONFLICT (collector_id) DO NOTHING" prevents errors or duplicates if you run this script again.
    console.log('Inserting sample collector (if they do not exist)...');
    await client.query(
      `INSERT INTO collectors (collector_id, password, full_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (collector_id) DO NOTHING`,
      ['C-101', 'password123', 'Juan Dela Cruz']
    );

    // Commit the transaction to save the changes
    await client.query('COMMIT');
    console.log('✅ Collector setup completed successfully!');

  } catch (error) {
    // If any error occurs, roll back the transaction
    await client.query('ROLLBACK');
    console.error('❌ Error during collector setup:', error);
    
  } finally {
    // Always release the client and end the pool connection
    client.release();
    pool.end();
    console.log('Database connection closed.');
  }
};

// Run the setup function
setupCollectors();