require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { initDB } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3737;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/products',     require('./routes/products'));
app.use('/api/distributors', require('./routes/distributors'));
app.use('/api/purchase',     require('./routes/purchase'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/analytics',      require('./routes/analytics'));
app.use('/api/opening-stock',  require('./routes/opening-stock'));

// Shop info (for frontend config)
app.get('/api/config', (req, res) => {
  res.json({
    shop_name:    process.env.SHOP_NAME    || 'Your Store',
    shop_address: process.env.SHOP_ADDRESS || '',
    shop_contact: process.env.SHOP_CONTACT || '',
    shop_gst:     process.env.SHOP_GST     || '',
    shop_email:   process.env.SHOP_EMAIL   || ''
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
    if (process.send) process.send('ready');
  });
}

start().catch(console.error);
