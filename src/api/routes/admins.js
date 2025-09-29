const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// This route must exist and use router.post('/login', ...)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ msg: 'Please enter all fields.' });
    }

    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ msg: 'Invalid credentials.' });
        }

        const admin = result.rows[0];
        // Direct password comparison (as requested)
        const isMatch = (password === admin.password);
        
        if (!isMatch) {
            return res.status(401).json({ msg: 'Invalid credentials.' });
        }
        
        const payload = { id: admin.id, name: admin.full_name };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'your_default_secret_key', { expiresIn: '1h' });

        res.json({ token, admin: payload });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

module.exports = router;