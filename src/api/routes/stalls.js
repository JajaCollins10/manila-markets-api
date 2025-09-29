// File: routes/stalls.js

const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// GET stalls, now with optional filtering by market_name
router.get('/', async (req, res) => {
  // --- ENHANCEMENT: Accept a market_name query parameter ---
  const { market_name } = req.query; 

  try {
    const client = await pool.connect();
    
    let query = `
      SELECT
        s.id, s.stall_code, s.status, s.rent_amount, s.lease_end,
        v.name AS tenant_name, v.wallet_balance, m.name AS market_name
      FROM stalls s
      LEFT JOIN vendors v ON s.vendor_id = v.id
      JOIN markets m ON s.market_id = m.id
    `;
    
    const queryParams = [];

    // If a market_name is provided, add a WHERE clause
    if (market_name) {
      query += ' WHERE m.name = $1';
      queryParams.push(market_name);
    }
    
    query += ' ORDER BY s.stall_code;';

    const result = await client.query(query, queryParams);
    
    res.json(result.rows);
    client.release();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/lookup', async (req, res) => {
  const { businessId } = req.query;
  if (!businessId) {
    return res.status(400).json({ msg: 'Business ID is required.' });
  }

  const client = await pool.connect();
  try {
    const query = `
      SELECT
        s.stall_code,
        s.status as stall_status,
        s.rent_amount,
        s.lease_end,
        v.name as vendor_name,
        v.wallet_balance,
        v.business_id_number,
        m.name as market_name
      FROM vendors v
      LEFT JOIN stalls s ON v.id = s.vendor_id
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE v.business_id_number = $1;
    `;
    
    const result = await client.query(query, [businessId.trim()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'No stall found for this Business ID.' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
});


module.exports = router;