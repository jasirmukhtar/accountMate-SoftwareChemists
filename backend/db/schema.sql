-- ============================================================
--  MARG ERP - Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS marg_erp;
USE marg_erp;

-- Products master
CREATE TABLE IF NOT EXISTS products (
  product_id    INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  unit          VARCHAR(30) DEFAULT 'PCS',
  hsn_code      VARCHAR(20),
  gst_percent   DECIMAL(5,2) DEFAULT 0.00,
  is_active     TINYINT DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Distributors (registered)
CREATE TABLE IF NOT EXISTS distributors (
  distributor_id INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  address        TEXT,
  contact        VARCHAR(20),
  gst_no         VARCHAR(20),
  is_active      TINYINT DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Retailers / Customers
CREATE TABLE IF NOT EXISTS customers (
  customer_id  INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  address      TEXT,
  contact      VARCHAR(20),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Header
CREATE TABLE IF NOT EXISTS purchase_header (
  purchase_id      INT AUTO_INCREMENT PRIMARY KEY,
  distributor_id   INT NOT NULL,
  invoice_no       VARCHAR(50),
  purchase_date    DATE NOT NULL,
  total_amount     DECIMAL(12,2) DEFAULT 0.00,
  discount_amount  DECIMAL(12,2) DEFAULT 0.00,
  net_amount       DECIMAL(12,2) DEFAULT 0.00,
  remarks          TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(distributor_id)
);

-- Purchase Detail Lines
CREATE TABLE IF NOT EXISTS purchase_details (
  detail_id      INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id    INT NOT NULL,
  product_id     INT NOT NULL,
  batch_no       VARCHAR(50),
  expiry_date    DATE,
  mrp            DECIMAL(10,2) NOT NULL,
  purchase_rate  DECIMAL(10,2) NOT NULL,
  qty_ordered    INT DEFAULT 0,
  qty_free       INT DEFAULT 0,
  qty_total      INT AS (qty_ordered + qty_free) STORED,
  discount_pct   DECIMAL(5,2) DEFAULT 0.00,
  gst_pct        DECIMAL(5,2) DEFAULT 0.00,
  line_amount    DECIMAL(12,2) DEFAULT 0.00,
  FOREIGN KEY (purchase_id) REFERENCES purchase_header(purchase_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Stock Table (updated on purchase, decremented on sale)
CREATE TABLE IF NOT EXISTS stock (
  stock_id      INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT NOT NULL,
  purchase_id   INT,
  batch_no      VARCHAR(50),
  expiry_date   DATE,
  mrp           DECIMAL(10,2),
  purchase_rate DECIMAL(10,2),
  qty_in        INT DEFAULT 0,
  qty_sold      INT DEFAULT 0,
  qty_balance   INT AS (qty_in - qty_sold) STORED,
  gst_pct       DECIMAL(5,2) DEFAULT 0.00,
  added_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (purchase_id) REFERENCES purchase_header(purchase_id)
);

-- Sales Header
CREATE TABLE IF NOT EXISTS sales_header (
  sales_invoice_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no       VARCHAR(50) UNIQUE,
  customer_name    VARCHAR(200) NOT NULL,
  customer_address TEXT,
  customer_contact VARCHAR(20),
  sale_date        DATE NOT NULL,
  total_amount     DECIMAL(12,2) DEFAULT 0.00,
  discount_amount  DECIMAL(12,2) DEFAULT 0.00,
  gst_amount       DECIMAL(12,2) DEFAULT 0.00,
  net_amount       DECIMAL(12,2) DEFAULT 0.00,
  payment_mode     ENUM('CASH','CREDIT','UPI','CHEQUE') DEFAULT 'CASH',
  remarks          TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Items
CREATE TABLE IF NOT EXISTS sales_items (
  item_id          INT AUTO_INCREMENT PRIMARY KEY,
  sales_invoice_id INT NOT NULL,
  product_id       INT NOT NULL,
  stock_id         INT,
  batch_no         VARCHAR(50),
  expiry_date      DATE,
  mrp              DECIMAL(10,2),
  sale_rate        DECIMAL(10,2) NOT NULL,
  qty              INT NOT NULL,
  discount_pct     DECIMAL(5,2) DEFAULT 0.00,
  gst_pct          DECIMAL(5,2) DEFAULT 0.00,
  line_amount      DECIMAL(12,2) DEFAULT 0.00,
  FOREIGN KEY (sales_invoice_id) REFERENCES sales_header(sales_invoice_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id),
  FOREIGN KEY (stock_id) REFERENCES stock(stock_id)
);

