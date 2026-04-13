require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'marg_erp',
  port:     parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

async function initDB() {
  try {
    // Create DB if not exists
    const tempConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT) || 3306,
      multipleStatements: true
    });
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await tempConn.query(schema);
    await tempConn.end();
    console.log('[DB] Schema initialized');
  } catch (err) {
    console.error('[DB] Init error:', err.message);
  }
}

module.exports = { pool, initDB };
