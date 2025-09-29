// File: routes/reports.js

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
// Endpoint for the "Action Center" on the MarketDashboard
router.get('/insights', async (req, res) => {
  const { market_name } = req.query;
  if (!market_name) {
    return res.status(400).send('market_name query parameter is required.');
  }

  const client = await pool.connect();
  try {
    const overdueQuery = `
      SELECT v.name as tenant_name, s.stall_code, s.lease_end, s.rent_amount
      FROM stalls s
      JOIN vendors v ON s.vendor_id = v.id
      JOIN markets m ON s.market_id = m.id
      WHERE s.status = 'unpaid' AND s.lease_end < NOW() AND m.name = $1
      ORDER BY s.lease_end ASC;
    `;

    const upcomingRenewalsQuery = `
      SELECT v.name as tenant_name, s.stall_code, s.lease_end, v.wallet_balance
      FROM stalls s
      JOIN vendors v ON s.vendor_id = v.id
      JOIN markets m ON s.market_id = m.id
      WHERE s.status = 'paid' AND s.lease_end BETWEEN NOW() AND NOW() + interval '7 days' AND m.name = $1
      ORDER BY s.lease_end ASC;
    `;

    const [overdueRes, renewalsRes] = await Promise.all([
        client.query(overdueQuery, [market_name]),
        client.query(upcomingRenewalsQuery, [market_name])
    ]);

    res.json({
        overduePayments: overdueRes.rows,
        upcomingRenewals: renewalsRes.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
});

// Endpoint for the City-Wide ReportsDashboard
router.get('/city-wide-summary', async (req, res) => {
    const client = await pool.connect();
    try {
        const summaryQuery = `
            SELECT
                m.name AS market_name,
                COUNT(s.id) AS total_stalls,
                COUNT(s.vendor_id) AS occupied_stalls,
                SUM(CASE WHEN s.status = 'vacant' THEN 1 ELSE 0 END) AS vacant_stalls,
                SUM(CASE WHEN s.status = 'paid' THEN 1 ELSE 0 END) AS paid_stalls,
                SUM(CASE WHEN s.status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_stalls,
                SUM(CASE WHEN s.status = 'paid' THEN s.rent_amount ELSE 0 END) AS collected_revenue,
                SUM(CASE WHEN s.status = 'unpaid' THEN s.rent_amount ELSE 0 END) AS outstanding_revenue
            FROM stalls s
            JOIN markets m ON s.market_id = m.id
            GROUP BY m.name
            ORDER BY m.name;
        `;
        const summaryResult = await client.query(summaryQuery);
        res.json(summaryResult.rows);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});


// --- NEW ENDPOINT: Add this entire block ---
// Endpoint for a single market's summary data
router.get('/market-summary', async (req, res) => {
    const { market_name } = req.query;
    if (!market_name) {
        return res.status(400).send('market_name query parameter is required.');
    }

    const client = await pool.connect();
    try {
        const summaryQuery = `
            SELECT
                m.name AS market_name,
                COUNT(s.id) AS total_stalls,
                COUNT(s.vendor_id) AS occupied_stalls,
                SUM(CASE WHEN s.status = 'vacant' THEN 1 ELSE 0 END) AS vacant_stalls,
                SUM(CASE WHEN s.status = 'paid' THEN 1 ELSE 0 END) AS paid_stalls,
                SUM(CASE WHEN s.status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_stalls,
                SUM(CASE WHEN s.status = 'paid' THEN s.rent_amount ELSE 0 END) AS collected_revenue,
                SUM(CASE WHEN s.status = 'unpaid' THEN s.rent_amount ELSE 0 END) AS outstanding_revenue
            FROM stalls s
            JOIN markets m ON s.market_id = m.id
            WHERE m.name = $1 -- Filter by market name
            GROUP BY m.name;
        `;
        const summaryResult = await client.query(summaryQuery, [market_name]);
        
        if (summaryResult.rows.length === 0) {
            // If no data, return a structured object with zeros
            return res.json({
                market_name: market_name,
                total_stalls: 0,
                occupied_stalls: 0,
                // ... add other fields with 0 if needed
            });
        }
        
        // Return the first (and only) row as an object
        res.json(summaryResult.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});
// --- END of new block ---

module.exports = router;