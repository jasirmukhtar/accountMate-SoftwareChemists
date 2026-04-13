const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');

// Get all purchases
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ph.*, d.name as distributor_name,
              COUNT(pd.detail_id) as item_count
       FROM purchase_header ph
       JOIN distributors d ON ph.distributor_id=d.distributor_id
       LEFT JOIN purchase_details pd ON ph.purchase_id=pd.purchase_id
       GROUP BY ph.purchase_id
       ORDER BY ph.purchase_date DESC, ph.created_at DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get single purchase with details
router.get('/:id', async (req, res) => {
  try {
    const [[header]] = await pool.query(
      `SELECT ph.*, d.name as distributor_name
       FROM purchase_header ph
       JOIN distributors d ON ph.distributor_id=d.distributor_id
       WHERE ph.purchase_id=?`, [req.params.id]
    );
    const [items] = await pool.query(
      `SELECT pd.*, p.name as product_name, p.unit
       FROM purchase_details pd
       JOIN products p ON pd.product_id=p.product_id
       WHERE pd.purchase_id=?`, [req.params.id]
    );
    res.json({ header, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create purchase
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { header, items } = req.body;
    if (!header.distributor_id || !header.purchase_date || !items || items.length === 0) {
      throw new Error('Missing required fields');
    }

    // Calculate totals
    let totalAmount = 0;
    items.forEach(item => { totalAmount += parseFloat(item.line_amount || 0); });
    const netAmount = totalAmount - parseFloat(header.discount_amount || 0);

    // Insert purchase header
    const [hRes] = await conn.query(
      `INSERT INTO purchase_header
       (distributor_id, invoice_no, purchase_date, total_amount, discount_amount, net_amount, remarks)
       VALUES (?,?,?,?,?,?,?)`,
      [header.distributor_id, header.invoice_no, header.purchase_date,
       totalAmount, header.discount_amount || 0, netAmount, header.remarks || '']
    );
    const purchaseId = hRes.insertId;

    // Insert detail lines + update stock
    for (const item of items) {
      const qtyTotal = parseInt(item.qty_ordered || 0) + parseInt(item.qty_free || 0);
      const batchNo  = (item.batch_no || '').trim();
      const expiry   = item.expiry_date || null;
      const mrp      = parseFloat(item.mrp);

      // Insert purchase detail line (always — full audit trail per purchase)
      await conn.query(
        `INSERT INTO purchase_details
         (purchase_id, product_id, batch_no, expiry_date, mrp, purchase_rate,
          qty_ordered, qty_free, discount_pct, gst_pct, line_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [purchaseId, item.product_id, batchNo, expiry,
         mrp, item.purchase_rate, item.qty_ordered, item.qty_free || 0,
         item.discount_pct || 0, item.gst_pct || 0, item.line_amount]
      );

      // Stock: check if same batch already exists
      // Match on: product_id + batch_no + expiry_date + mrp
      // This means buying same batch from two distributors merges into one stock row
      // (same physical batch = same MRP, same expiry, same batch number)
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
        // Merge: just add qty to existing batch row
        // Also update purchase_rate to latest (most recent supplier's price)
        await conn.query(
          `UPDATE stock
           SET qty_in = qty_in + ?,
               purchase_rate = ?
           WHERE stock_id = ?`,
          [qtyTotal, item.purchase_rate, existing.stock_id]
        );
      } else {
        // New batch: insert fresh stock row
        await conn.query(
          `INSERT INTO stock
           (product_id, purchase_id, batch_no, expiry_date, mrp, purchase_rate, qty_in, qty_sold, gst_pct)
           VALUES (?,?,?,?,?,?,?,0,?)`,
          [item.product_id, purchaseId, batchNo, expiry,
           mrp, item.purchase_rate, qtyTotal, item.gst_pct || 0]
        );
      }
    }

    await conn.commit();
    res.json({ purchase_id: purchaseId, message: 'Purchase saved & stock updated' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Delete purchase
// NOTE: When a purchase is deleted and its items were merged into existing stock rows,
// we reduce qty_in by the purchased qty rather than deleting the stock row outright.
router.delete('/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get all detail lines for this purchase
    const [details] = await conn.query(
      'SELECT * FROM purchase_details WHERE purchase_id=?', [req.params.id]
    );

    for (const d of details) {
      const qtyTotal = d.qty_total || (d.qty_ordered + d.qty_free);
      const batchNo  = (d.batch_no || '').trim();
      const expiry   = d.expiry_date || null;

      // Find matching stock row
      const [[stockRow]] = await conn.query(
        `SELECT stock_id, qty_in, qty_sold FROM stock
         WHERE product_id = ?
           AND batch_no   = ?
           AND mrp        = ?
           AND (
             (expiry_date IS NULL AND ? IS NULL)
             OR expiry_date = ?
           )
         LIMIT 1`,
        [d.product_id, batchNo, d.mrp, expiry, expiry]
      );

      if (stockRow) {
        const newQtyIn = stockRow.qty_in - qtyTotal;
        if (newQtyIn <= stockRow.qty_sold) {
          // Removing this purchase would make balance negative — block deletion
          throw new Error(
            `Cannot delete: stock for batch "${batchNo}" has already been partially or fully sold. Reverse the sales first.`
          );
        }
        if (newQtyIn <= 0) {
          // No qty left at all — remove the stock row entirely
          await conn.query('DELETE FROM stock WHERE stock_id=?', [stockRow.stock_id]);
        } else {
          // Reduce qty
          await conn.query(
            'UPDATE stock SET qty_in = ? WHERE stock_id=?',
            [newQtyIn, stockRow.stock_id]
          );
        }
      }
    }

    await conn.query('DELETE FROM purchase_details WHERE purchase_id=?', [req.params.id]);
    await conn.query('DELETE FROM purchase_header WHERE purchase_id=?', [req.params.id]);

    await conn.commit();
    res.json({ message: 'Purchase deleted and stock adjusted' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;