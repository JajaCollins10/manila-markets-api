// seed.js

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const markets = [
  { id: 1, name: 'Divisoria Market', location: 'Tondo, Manila' },
  { id: 2, name: 'Quiapo Market', location: 'Quiapo, Manila' },
  { id: 3, name: 'Paco Market', location: 'Paco, Manila' },
  { id: 4, name: 'Sampaloc Market', location: 'Sampaloc, Manila' },
];

const createRandomVendor = () => {
  const firstNames = ['Juan', 'Maria', 'Jose', 'Anna', 'Pedro', 'Clara', 'Luis', 'Sofia'];
  const lastNames = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Lim', 'Tan', 'Villanueva'];
  return {
    name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
    wallet_balance: parseFloat((Math.random() * 5000 + 500).toFixed(2)),
  };
};

// CORRECTED: Using your original stall definitions and prefixes to match your SVG
const stallDefinitions = {
    meat: { prefix: 'f', count: 60, rent: 80 },
    fish: { prefix: 's', count: 28, rent: 70 },
    fruits_vegetables: { prefix: 'm', count: 60, rent: 50 },
    dairies_condiments: { prefix: 'p', count: 30, rent: 50 },
    dry: { prefix: 'd', count: 26, rent: 40 },
};

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS transactions, stalls, vendors, markets CASCADE;');

    console.log('Creating new tables...');
    await client.query(`
      CREATE TABLE markets ( id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, location VARCHAR(100) );
      CREATE TABLE vendors ( id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, business_id_number VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE, password VARCHAR(255), wallet_balance NUMERIC(10, 2) DEFAULT 0.00 );
      CREATE TABLE stalls ( id SERIAL PRIMARY KEY, stall_code VARCHAR(20) NOT NULL, market_id INTEGER REFERENCES markets(id), vendor_id INTEGER REFERENCES vendors(id) NULL, status VARCHAR(20) NOT NULL, rent_amount NUMERIC(10, 2) NOT NULL, lease_end DATE, UNIQUE(stall_code, market_id) );
      CREATE TABLE transactions ( id SERIAL PRIMARY KEY, vendor_id INTEGER NOT NULL REFERENCES vendors(id), type VARCHAR(50) NOT NULL, amount NUMERIC(10, 2) NOT NULL, transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );
    `);
    
    console.log('Inserting markets...');
    for (const market of markets) { await client.query('INSERT INTO markets (id, name, location) VALUES ($1, $2, $3)', [market.id, market.name, market.location]); }

    console.log('Inserting vendors, stalls, and transactions...');
    let vendorIdCounter = 1;
    for (const market of markets) {
        for (const section in stallDefinitions) {
            const { prefix, count, rent } = stallDefinitions[section];
            for (let i = 1; i <= count; i++) {
                const stallCode = `${prefix}${i}`;
                let randomStatus = ['paid', 'unpaid', 'vacant'][Math.floor(Math.random() * 3)];
                if (vendorIdCounter === 1) { randomStatus = 'unpaid'; }

                if (randomStatus !== 'vacant') {
                    const vendorData = createRandomVendor();
                    const businessIdNumber = `MNL-BID-${100000 + vendorIdCounter}`;
                    const vendorRes = await client.query( 'INSERT INTO vendors (name, wallet_balance, business_id_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING id', [vendorData.name, vendorData.wallet_balance, businessIdNumber, `vendor${vendorIdCounter}@market.com`, 'password123'] );
                    const vendorId = vendorRes.rows[0].id;
                    
                    const today = new Date();
                    const leaseEnd = (randomStatus === 'paid') ? new Date(new Date().setDate(today.getDate() + 25)) : new Date(new Date().setDate(today.getDate() - 5));
                    
                    await client.query( `INSERT INTO stalls (stall_code, market_id, vendor_id, status, rent_amount, lease_end) VALUES ($1, $2, $3, $4, $5, $6)`, [stallCode, market.id, vendorId, randomStatus, rent, leaseEnd] );
                    await client.query('INSERT INTO transactions (vendor_id, type, amount) VALUES ($1, $2, $3)', [vendorId, 'top-up', vendorData.wallet_balance]);
                    vendorIdCounter++;
                } else {
                     await client.query( `INSERT INTO stalls (stall_code, market_id, status, rent_amount) VALUES ($1, $2, 'vacant', $3)`, [stallCode, market.id, rent] );
                }
            }
        }
    }
    await client.query('COMMIT');
    console.log('Database seeded successfully! 🌱');
  } catch (error) {
    await client.query('ROLLBACK'); console.error('Error seeding database:', error);
  } finally {
    client.release(); pool.end();
  }
};

seedDatabase();