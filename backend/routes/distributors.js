const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM distributors WHERE is_active=1 ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, address, contact, gst_no } = req.body;
  try {
    const [r] = await pool.query(
      'INSERT INTO distributors (name, address, contact, gst_no) VALUES (?,?,?,?)',
      [name, address, contact, gst_no]
    );
    res.json({ distributor_id: r.insertId, message: 'Distributor added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
