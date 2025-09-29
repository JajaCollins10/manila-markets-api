// File: src/app.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// These paths are relative to src/app.js
const stallsRouter = require('./api/routes/stalls');
const vendorsRouter = require('./api/routes/vendors');
const reportsRouter = require('./api/routes/reports');
const collectorsRouter = require('./api/routes/collectors');
const adminsRouter = require('./api/routes/admins');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/stalls', stallsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/collectors', collectorsRouter);
app.use('/api/admins', adminsRouter);

// This starts the server and keeps it running
app.listen(PORT, () => {
  console.log(`✅ Server is running and listening on port ${PORT}`);
});