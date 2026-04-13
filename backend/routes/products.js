const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');

// Get all products
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE is_active=1 ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add product
router.post('/', async (req, res) => {
  const { name, unit, hsn_code, gst_percent } = req.body;
  try {
    const [r] = await pool.query(
      'INSERT INTO products (name, unit, hsn_code, gst_percent) VALUES (?,?,?,?)',
      [name, unit || 'PCS', hsn_code || null, gst_percent || 0]
    );
    res.json({ product_id: r.insertId, message: 'Product added' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update product
router.put('/:id', async (req, res) => {
  const { name, unit, hsn_code, gst_percent } = req.body;
  try {
    await pool.query(
      'UPDATE products SET name=?, unit=?, hsn_code=?, gst_percent=? WHERE product_id=?',
      [name, unit, hsn_code, gst_percent, req.params.id]
    );
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get stock for product (for sale dropdown)
router.get('/:id/stock', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, p.name as product_name, p.unit
       FROM stock s JOIN products p ON s.product_id=p.product_id
       WHERE s.product_id=? AND s.qty_balance>0
       ORDER BY s.expiry_date ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all stock summary
router.get('/stock/all', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.product_id, p.name, p.unit, 
              SUM(s.qty_balance) as total_stock,
              MIN(s.expiry_date) as nearest_expiry,
              COUNT(s.stock_id) as batches
       FROM products p
       LEFT JOIN stock s ON p.product_id=s.product_id AND s.qty_balance>0
       WHERE p.is_active=1
       GROUP BY p.product_id, p.name, p.unit
       ORDER BY p.name`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// Get last purchase rate + MRP for a product (for pre-filling purchase/opening stock forms)
router.get('/:id/last-rate', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT pd.purchase_rate, pd.mrp, pd.gst_pct, pd.batch_no, pd.expiry_date
       FROM purchase_details pd
       JOIN purchase_header ph ON pd.purchase_id = ph.purchase_id
       WHERE pd.product_id = ?
       ORDER BY ph.purchase_date DESC, ph.created_at DESC
       LIMIT 1`,
      [req.params.id]
    );
    // Also check opening stock if no purchase found
    if (!row) {
      const [[osRow]] = await pool.query(
        `SELECT purchase_rate, mrp, gst_pct FROM stock
         WHERE product_id = ? AND purchase_id IS NULL
         ORDER BY added_at DESC LIMIT 1`,
        [req.params.id]
      );
      return res.json(osRow || null);
    }
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});