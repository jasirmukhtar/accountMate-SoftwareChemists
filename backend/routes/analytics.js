const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');

// Dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 8) + '01';

    const [[todaySale]] = await pool.query(
      'SELECT COALESCE(SUM(net_amount),0) as total, COUNT(*) as count FROM sales_header WHERE sale_date=?', [today]
    );
    const [[monthSale]] = await pool.query(
      'SELECT COALESCE(SUM(net_amount),0) as total, COUNT(*) as count FROM sales_header WHERE sale_date BETWEEN ? AND ?', [monthStart, today]
    );
    const [[todayPurchase]] = await pool.query(
      'SELECT COALESCE(SUM(net_amount),0) as total, COUNT(*) as count FROM purchase_header WHERE purchase_date=?', [today]
    );
    const [[stockValue]] = await pool.query(
      'SELECT COALESCE(SUM(qty_balance * purchase_rate),0) as value FROM stock WHERE qty_balance>0'
    );
    const [[lowStock]] = await pool.query(
      `SELECT COUNT(DISTINCT product_id) as cnt FROM (
        SELECT product_id, SUM(qty_balance) as total FROM stock GROUP BY product_id HAVING total < 10
       ) t`
    );
    const [[expiryAlert]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM stock 
       WHERE qty_balance>0 AND expiry_date IS NOT NULL 
       AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)`
    );

    res.json({
      today_sale: todaySale,
      month_sale: monthSale,
      today_purchase: todayPurchase,
      stock_value: stockValue.value,
      low_stock: lowStock.cnt,
      expiry_alert: expiryAlert.cnt
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Daywise sales for chart (last N days)
router.get('/daywise', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const [rows] = await pool.query(
      `SELECT sale_date, 
              SUM(net_amount) as total_sale,
              SUM(total_amount) as gross_sale,
              COUNT(sales_invoice_id) as invoice_count
       FROM sales_header
       WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY sale_date
       ORDER BY sale_date ASC`, [days]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Top selling products
router.get('/top-products', async (req, res) => {
  try {
    const { from, to } = req.query;
    const f = from || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
    const t = to || new Date().toISOString().split('T')[0];
    const [rows] = await pool.query(
      `SELECT p.name, SUM(si.qty) as total_qty, SUM(si.line_amount) as total_revenue
       FROM sales_items si
       JOIN products p ON si.product_id=p.product_id
       JOIN sales_header sh ON si.sales_invoice_id=sh.sales_invoice_id
       WHERE sh.sale_date BETWEEN ? AND ?
       GROUP BY si.product_id, p.name
       ORDER BY total_revenue DESC
       LIMIT 10`, [f, t]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Monthly trend
router.get('/monthly', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(sale_date,'%Y-%m') as month,
              SUM(net_amount) as total_sale,
              COUNT(*) as invoice_count
       FROM sales_header
       WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(sale_date,'%Y-%m')
       ORDER BY month ASC`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expiry alert stock
router.get('/expiry-alerts', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, p.name as product_name, p.unit,
              DATEDIFF(s.expiry_date, CURDATE()) as days_left
       FROM stock s
       JOIN products p ON s.product_id=p.product_id
       WHERE s.qty_balance>0 AND s.expiry_date IS NOT NULL
       AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
       ORDER BY s.expiry_date ASC`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
