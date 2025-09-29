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
// --- No changes to /login or /me routes ---
router.post('/login', async (req, res) => {
    const { businessId, password } = req.body;

    if (!businessId || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    const client = await pool.connect();
    try {
        const vendorResult = await client.query(
            'SELECT * FROM vendors WHERE business_id_number = $1',
            [businessId]
        );

        if (vendorResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Vendor with this Business ID not found.' });
        }

        const vendor = vendorResult.rows[0];

        if (vendor.password !== password) {
            return res.status(401).json({ msg: 'Invalid credentials.' });
        }
        
        res.status(200).json({ 
            msg: 'Login successful!',
            vendor: {
                id: vendor.id,
                name: vendor.name,
                email: vendor.email,
                wallet_balance: vendor.wallet_balance
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

router.get('/me', async (req, res) => {
    const businessIdToDemo = 'MNL-BID-100001'; 

    const client = await pool.connect();
    try {
        const vendorResult = await client.query(
            'SELECT id, name, email, wallet_balance, business_id_number FROM vendors WHERE business_id_number = $1',
            [businessIdToDemo]
        );

        if (vendorResult.rows.length === 0) return res.status(404).json({ msg: 'Demo vendor not found.' });
        const vendor = vendorResult.rows[0];

        const stallResult = await client.query(
            `SELECT s.id, s.stall_code, s.lease_end, s.status as payment_status, s.rent_amount as daily_rent_rate, m.name as market_name
             FROM stalls s
             JOIN markets m ON s.market_id = m.id
             WHERE s.vendor_id = $1`,
            [vendor.id]
        );

        const transactionsResult = await client.query(
            `SELECT id, type, amount, transaction_date as date
             FROM transactions
             WHERE vendor_id = $1
             ORDER BY transaction_date DESC
             LIMIT 10`,
            [vendor.id]
        );

        res.status(200).json({
            vendor,
            stall: stallResult.rows[0] || null,
            transactions: transactionsResult.rows,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});


// --- UPDATED /payrent ROUTE ---
router.post('/payrent', async (req, res) => {
    // Note: The 'daysToPay' field is still required for the lease_end calculation.
    const { vendorId, stallId, amount, daysToPay } = req.body;
    
    // The validation check remains.
    if (!vendorId || !stallId || !amount || !daysToPay || amount <= 0 || daysToPay <= 0) {
        return res.status(400).json({ msg: 'Invalid data provided. All fields are required.' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. REMOVED: Wallet balance check. We assume payment is confirmed by the gateway.
        // The frontend now sends a payment that has been "processed" by the simulated gateway.

        // 2. Update stall lease_end date and status.
        // This logic correctly uses the 'daysToPay' to extend the lease.
        const interval = `${Math.ceil(daysToPay)} days`; // Use Math.ceil to handle fractions
        await client.query(
          `UPDATE stalls 
           SET status = 'paid', 
               lease_end = (CASE WHEN lease_end < NOW() THEN NOW() ELSE lease_end END) + $1::interval
           WHERE id = $2`,
          [interval, stallId]
        );

        // 3. Log the transaction.
        await client.query(
            'INSERT INTO transactions (vendor_id, type, amount) VALUES ($1, $2, $3)',
            [vendorId, 'rent', -amount]
        );

        await client.query('COMMIT');
        res.status(200).json({ msg: 'Payment successful!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});


// The /topup route can be removed if you are fully deprecating the wallet system,
// but I will leave it here in case you need it for other purposes.
router.post('/topup', async (req, res) => {
    const { vendorId, amount } = req.body;
    if (!vendorId || !amount || amount <= 0) {
        return res.status(400).json({ msg: 'Invalid data provided.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const updatedVendor = await client.query(
            'UPDATE vendors SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance',
            [amount, vendorId]
        );
        
        await client.query(
            'INSERT INTO transactions (vendor_id, type, amount) VALUES ($1, $2, $3)',
            [vendorId, 'top-up', amount]
        );

        await client.query('COMMIT');
        res.status(200).json({ new_balance: updatedVendor.rows[0].wallet_balance });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});


module.exports = router;