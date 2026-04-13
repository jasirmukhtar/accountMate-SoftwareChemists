const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');

// Get all opening stock entries
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, p.name as product_name, p.unit
       FROM stock s
       JOIN products p ON s.product_id = p.product_id
       WHERE s.purchase_id IS NULL
       ORDER BY s.added_at DESC`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add opening stock — merges into existing batch if product+batch+expiry+mrp match
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items } = req.body;
    if (!items || items.length === 0) throw new Error('No items provided');

    const results = [];

    for (const item of items) {
      if (!item.product_id || !item.qty_in || item.qty_in <= 0) {
        throw new Error(`Invalid entry for product_id ${item.product_id}`);
      }

      const batchNo = (item.batch_no || '').trim();
      const expiry  = item.expiry_date || null;
      const mrp     = parseFloat(item.mrp || 0);

      // Check if same batch already exists in stock (from any source — purchase or opening)
      const [[existing]] = await conn.query(
        `SELECT stock_id FROM stock
         WHERE product_id = ?
           AND batch_no   = ?
           AND mrp        = ?
           AND (
             (expiry_date IS NULL AND ? IS NULL)
             OR expiry_date = ?
           )
         LIMIT 1`,
        [item.product_id, batchNo, mrp, expiry, expiry]
      );

      if (existing) {
        // Merge — add qty to existing row, update rate to latest
        await conn.query(
          `UPDATE stock
           SET qty_in = qty_in + ?,
               purchase_rate = ?
           WHERE stock_id = ?`,
          [item.qty_in, item.purchase_rate || 0, existing.stock_id]
        );
        results.push({ stock_id: existing.stock_id, merged: true });
      } else {
        // New batch
        const [r] = await conn.query(
          `INSERT INTO stock
             (product_id, purchase_id, batch_no, expiry_date, mrp, purchase_rate, qty_in, qty_sold, gst_pct)
           VALUES (?, NULL, ?, ?, ?, ?, ?, 0, ?)`,
          [item.product_id, batchNo, expiry, mrp,
           item.purchase_rate || 0, item.qty_in, item.gst_pct || 0]
        );
        results.push({ stock_id: r.insertId, merged: false });
      }
    }

    await conn.commit();

    const merged = results.filter(r => r.merged).length;
    const created = results.filter(r => !r.merged).length;
    let msg = [];
    if (created) msg.push(`${created} new batch${created > 1 ? 'es' : ''} added`);
    if (merged)  msg.push(`${merged} existing batch${merged > 1 ? 'es' : ''} updated`);

    res.json({ results, message: msg.join(', ') });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Delete a single opening stock entry
router.delete('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT stock_id, qty_sold, purchase_id FROM stock WHERE stock_id = ?', [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.purchase_id !== null) return res.status(400).json({ error: 'Belongs to a purchase — delete the purchase instead' });
    if (row.qty_sold > 0) return res.status(400).json({ error: 'Cannot delete — qty already sold from this batch' });

    await pool.query('DELETE FROM stock WHERE stock_id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;