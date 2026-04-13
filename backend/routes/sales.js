const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const PDFDocument = require('pdfkit');

// Get all sales
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `SELECT sh.*, COUNT(si.item_id) as item_count
                 FROM sales_header sh
                 LEFT JOIN sales_items si ON sh.sales_invoice_id=si.sales_invoice_id`;
    const params = [];
    if (from && to) {
      query += ' WHERE sh.sale_date BETWEEN ? AND ?';
      params.push(from, to);
    }
    query += ' GROUP BY sh.sales_invoice_id ORDER BY sh.sale_date DESC, sh.created_at DESC LIMIT 500';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get single sale with items
router.get('/:id', async (req, res) => {
  try {
    const [[header]] = await pool.query(
      'SELECT * FROM sales_header WHERE sales_invoice_id=?', [req.params.id]
    );
    const [items] = await pool.query(
      `SELECT si.*, p.name as product_name, p.unit
       FROM sales_items si
       JOIN products p ON si.product_id=p.product_id
       WHERE si.sales_invoice_id=?`, [req.params.id]
    );
    res.json({ header, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generate invoice number
async function generateInvoiceNo(conn) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const [[{ cnt }]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM sales_header 
     WHERE invoice_no LIKE ?`, [`INV-${year}${month}-%`]
  );
  const seq = String(parseInt(cnt) + 1).padStart(4, '0');
  return `INV-${year}${month}-${seq}`;
}

// Create sale
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { header, items } = req.body;
    if (!header.customer_name || !items || items.length === 0) {
      throw new Error('Missing required fields');
    }

    // Calculate totals
    let totalAmount = 0, gstAmount = 0;
    items.forEach(item => {
      totalAmount += parseFloat(item.line_amount || 0);
      const baseAmt = parseFloat(item.line_amount || 0) / (1 + (parseFloat(item.gst_pct || 0) / 100));
      gstAmount += parseFloat(item.line_amount || 0) - baseAmt;
    });
    const discountAmount = parseFloat(header.discount_amount || 0);
    const netAmount = totalAmount - discountAmount;

    const invoiceNo = await generateInvoiceNo(conn);

    // Insert header
    const [hRes] = await conn.query(
      `INSERT INTO sales_header
       (invoice_no, customer_name, customer_address, customer_contact, sale_date,
        total_amount, discount_amount, gst_amount, net_amount, payment_mode, remarks)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [invoiceNo, header.customer_name, header.customer_address || '',
       header.customer_contact || '', header.sale_date,
       totalAmount, discountAmount, gstAmount, netAmount,
       header.payment_mode || 'CASH', header.remarks || '']
    );
    const salesInvoiceId = hRes.insertId;

    // Insert items + decrement stock
    for (const item of items) {
      // Verify stock
      if (item.stock_id) {
        const [[stockRow]] = await conn.query(
          'SELECT qty_balance FROM stock WHERE stock_id=?', [item.stock_id]
        );
        if (!stockRow || stockRow.qty_balance < item.qty) {
          throw new Error(`Insufficient stock for product in batch ${item.batch_no}`);
        }
        // Decrement stock
        await conn.query(
          'UPDATE stock SET qty_sold = qty_sold + ? WHERE stock_id=?',
          [item.qty, item.stock_id]
        );
      }

      await conn.query(
        `INSERT INTO sales_items
         (sales_invoice_id, product_id, stock_id, batch_no, expiry_date,
          mrp, sale_rate, qty, discount_pct, gst_pct, line_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [salesInvoiceId, item.product_id, item.stock_id || null,
         item.batch_no || '', item.expiry_date || null,
         item.mrp, item.sale_rate, item.qty,
         item.discount_pct || 0, item.gst_pct || 0, item.line_amount]
      );
    }

    await conn.commit();
    res.json({ sales_invoice_id: salesInvoiceId, invoice_no: invoiceNo, message: 'Sale saved' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Generate PDF invoice
router.get('/:id/pdf', async (req, res) => {
  try {
    const [[header]] = await pool.query(
      'SELECT * FROM sales_header WHERE sales_invoice_id=?', [req.params.id]
    );
    if (!header) return res.status(404).json({ error: 'Invoice not found' });

    const [items] = await pool.query(
      `SELECT si.*, p.name as product_name, p.unit
       FROM sales_items si
       JOIN products p ON si.product_id=p.product_id
       WHERE si.sales_invoice_id=?`, [req.params.id]
    );

    // Shop details from env
    const shop = {
      name:    process.env.SHOP_NAME    || 'Your Store',
      address: process.env.SHOP_ADDRESS || '',
      contact: process.env.SHOP_CONTACT || '',
      email:   process.env.SHOP_EMAIL   || '',
      tagline: process.env.SHOP_TAGLINE || ''
    };

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${header.invoice_no}.pdf"`);
    doc.pipe(res);

    const W = 515; // usable width
    const pageW = 595;

    // Header block
    doc.rect(40, 40, W, 80).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
       .text(shop.name, 50, 52, { width: W - 20 });
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
       .text(shop.tagline, 50, 72, { width: 300 });
    doc.fillColor('#cbd5e1').fontSize(8)
       .text(shop.address, 50, 84)
       .text(`Ph: ${shop.contact} |  ${shop.email}`, 50, 96);

    // Invoice title band
    doc.rect(40, 125, W, 24).fill('#f59e0b');
    doc.fillColor('#000').fontSize(11).font('Helvetica-Bold')
       .text('SALES INVOICE', 40, 131, { width: W, align: 'center' });

    // Invoice meta
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
    const metaY = 158;
    doc.text(`Invoice No: `, 40, metaY).font('Helvetica-Bold').text(header.invoice_no, 110, metaY);
    doc.font('Helvetica').text(`Date: `, 350, metaY).font('Helvetica-Bold').text(header.sale_date, 375, metaY);
    doc.font('Helvetica').text(`Payment: `, 40, metaY + 14).font('Helvetica-Bold').text(header.payment_mode, 110, metaY + 14);

    // Bill to
    doc.rect(40, 185, W, 14).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('BILL TO', 44, 188);
    doc.font('Helvetica').fontSize(9)
       .text(header.customer_name, 44, 203)
       .text(header.customer_address || '', 44, 215)
       .text(header.customer_contact ? `Contact: ${header.customer_contact}` : '', 44, 227);

    // Table header
    const tY = 248;
    doc.rect(40, tY, W, 18).fill('#0f172a');
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica-Bold');
    const cols = [
      { label: '#',          x: 42,  w: 18  },
      { label: 'PRODUCT',    x: 62,  w: 140 },
      { label: 'BATCH',      x: 204, w: 55  },
      { label: 'EXPIRY',     x: 261, w: 48  },
      { label: 'MRP',        x: 311, w: 40  },
      { label: 'RATE',       x: 353, w: 40  },
      { label: 'QTY',        x: 395, w: 28  },
      { label: 'DISC%',      x: 425, w: 32  },
      { label: 'AMOUNT',     x: 459, w: 96  },
    ];
    cols.forEach(c => doc.text(c.label, c.x, tY + 5, { width: c.w, align: 'right' }));

    // Table rows
    let rowY = tY + 20;
    let sno = 1;
    items.forEach(item => {
      if (rowY > 720) { doc.addPage(); rowY = 60; }
      const bg = sno % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(40, rowY, W, 16).fill(bg);
      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
      doc.text(sno, cols[0].x, rowY + 4, { width: cols[0].w, align: 'right' });
      doc.text(item.product_name, cols[1].x, rowY + 4, { width: cols[1].w });
      doc.text(item.batch_no || '-', cols[2].x, rowY + 4, { width: cols[2].w });
      doc.text(item.expiry_date ? item.expiry_date.substring(0,7) : '-', cols[3].x, rowY + 4, { width: cols[3].w });
      doc.text(parseFloat(item.mrp).toFixed(2), cols[4].x, rowY + 4, { width: cols[4].w, align: 'right' });
      doc.text(parseFloat(item.sale_rate).toFixed(2), cols[5].x, rowY + 4, { width: cols[5].w, align: 'right' });
      doc.text(item.qty, cols[6].x, rowY + 4, { width: cols[6].w, align: 'right' });
      doc.text(`${item.discount_pct || 0}%`, cols[7].x, rowY + 4, { width: cols[7].w, align: 'right' });
      doc.text(parseFloat(item.line_amount).toFixed(2), cols[8].x, rowY + 4, { width: cols[8].w, align: 'right' });
      rowY += 16;
      sno++;
    });

    // Totals box
    rowY += 6;
    doc.rect(350, rowY, W - 310, 70).stroke('#e2e8f0');
    doc.fontSize(8).font('Helvetica').fillColor('#475569');
    const tl = (label, value, y) => {
      doc.text(label, 355, y).font('Helvetica-Bold').fillColor('#0f172a')
         .text(value, 480, y, { width: 70, align: 'right' });
      doc.font('Helvetica').fillColor('#475569');
    };
    tl('Subtotal:', `₹ ${parseFloat(header.total_amount).toFixed(2)}`, rowY + 8);
    tl('Discount:', `₹ ${parseFloat(header.discount_amount || 0).toFixed(2)}`, rowY + 22);
    // tl('GST:', `₹ ${parseFloat(header.gst_amount || 0).toFixed(2)}`, rowY + 36);
    doc.rect(350, rowY + 50, W - 310, 18).fill('#f59e0b');
    doc.fillColor('#000').fontSize(9).font('Helvetica-Bold')
       .text('NET AMOUNT:', 355, rowY + 55)
       .text(`₹ ${parseFloat(header.net_amount).toFixed(2)}`, 480, rowY + 55, { width: 70, align: 'right' });

    // Footer
    // const footY = doc.page.height - 60;
    // doc.moveTo(40, footY).lineTo(555, footY).stroke('#e2e8f0');
    // doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
    //    .text('Thank you for your business! Goods once sold will not be taken back. Subject to local jurisdiction.',
    //          40, footY + 8, { width: W, align: 'center' })
    //    .text(`${shop.name} | ${shop.contact}`, 40, footY + 22, { width: W, align: 'center' });

    doc.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;


