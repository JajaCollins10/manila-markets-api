// File: routes/collectors.js
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

// POST /api/collectors/login
router.post('/login', async (req, res) => {
    const { collectorId, password } = req.body;

    if (!collectorId || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM collectors WHERE collector_id = $1',
            [collectorId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ msg: 'Collector ID not found.' });
        }

        const collector = result.rows[0];

        // IMPORTANT: In a real app, use a library like bcrypt to compare hashed passwords.
        if (collector.password !== password) {
            return res.status(401).json({ msg: 'Invalid credentials.' });
        }
        
        // On success, send back collector data
        res.status(200).json({ 
            msg: 'Login successful!',
            collector: {
                id: collector.id,
                collector_id: collector.collector_id,
                full_name: collector.full_name,
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

module.exports = router;