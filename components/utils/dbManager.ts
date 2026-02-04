import { Pool } from 'pg';

// یک Pool برای postgres بیس (برای ساخت دیتابیس)
const adminPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres',  // اتصال به postgres default database
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Pool اصلی برای اتصال به دیتابیس ما
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'maxdiff_db',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

/**
 * دیتابیس را ایجاد کنید اگر موجود نباشد
 * @returns {Promise<void>}
 * @throws {Error} اگر ایجاد ناموفق باشد
 */
async function ensureDatabase(): Promise<void> {
  const dbName = process.env.DB_NAME || 'maxdiff_db';
  try {
    console.log(`🔍 Checking if database "${dbName}" exists...`);
    await adminPool.query(`CREATE DATABASE ${dbName};`);
    console.log(`✅ Database "${dbName}" created successfully`);
  } catch (error: any) {
    if (error.code === '42P04') {
      console.log(`✅ Database "${dbName}" already exists`);
    } else {
      throw error;
    }
  } finally {
    await adminPool.end();
  }
}

/**
 * دیتابیس را شروع کنید - جداول و indexها ایجاد کنید
 * @returns {Promise<void>}
 * @throws {Error} اگر ایجاد جدول ناموفق باشد
 */
// Initialize database - create single arbitrage_history table
async function initializeDatabase(): Promise<void> {
  try {
    console.log('📦 Initializing database...');

    // Step 1: Create exchanges table (لیست صرافی‌ها)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchanges (
        name VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Step 2: Create maxdiff_history table with Foreign Key
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maxdiff_history (
        id BIGSERIAL PRIMARY KEY,
        exchange_name VARCHAR(50) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        percent_difference DECIMAL(10, 2),
        exchange_price DECIMAL(20, 2),
        binance_price DECIMAL(20, 2),
        volume DECIMAL(20, 8),
        amount_irt DECIMAL(20, 2),
        status_compare VARCHAR(20),
        record_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_exchange_name 
          FOREIGN KEY (exchange_name) 
          REFERENCES exchanges(name) 
          ON DELETE CASCADE
      );
    `);

    // Create indexes for fast queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exchange_time 
      ON maxdiff_history(exchange_name, record_time DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_symbol_time 
      ON maxdiff_history(symbol, record_time DESC);
    `);

    // Index برای پیدا کردن بهترین فرصت‌ها
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exchange_percent 
      ON maxdiff_history(exchange_name, percent_difference DESC);
    `);

    // Index برای حذف داده‌های قدیم
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_created_at 
      ON maxdiff_history(created_at DESC);
    `);

    // Index برای جستجو بر اساس exchange و symbol
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exchange_symbol 
      ON maxdiff_history(exchange_name, symbol);
    `);

    console.log('✅ Database initialized successfully');
    console.log('📊 Tables created: exchanges, maxdiff_history');
    console.log('⚠️ Exchanges will be registered by each service');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

/**
 * صرافی جدید ثبت کنید
 * @param {string} exchangeName - نام صرافی (wallex, okex, nobitex)
 * @returns {Promise<boolean>} true اگر ثبت موفق باشد
 */
// Register exchange (هر صرافی خود را ثبت میکند)
async function registerExchange(exchangeName: string): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO exchanges (name) VALUES ($1) 
       ON CONFLICT (name) DO NOTHING;`,
      [exchangeName]
    );
    console.log(`✅ Exchange registered: ${exchangeName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error registering exchange ${exchangeName}:`, error);
    return false;
  }
}

/**
 * رکورد maxdiff جدید در دیتابیس درج کنید
 * @param {string} exchangeName - نام صرافی
 * @param {string} symbol - نماد (مثال: BTCIRT)
 * @param {number} percentDifference - درصد تفاوت قیمت
 * @param {number} exchangePrice - قیمت در صرافی
 * @param {number} binancePrice - قیمت در بایننس
 * @param {number} volume - حجم معاملات
 * @param {number} amountIrt - مقدار به IRT
 * @param {string} statusCompare - نوع مقایسه (UsdtVsIrt, UsdtVsUsdt)
 * @param {Date} [recordTime] - زمان رکورد (پیش‌فرض: الآن)
 * @returns {Promise<any>} رکورد inserted یا null اگر خطا باشد
 */
// Insert maxdiff record into history
async function insertMaxDiffRecord(
  exchangeName: string,
  symbol: string,
  percentDifference: number,
  exchangePrice: number,
  binancePrice: number,
  volume: number,
  amountIrt: number,
  statusCompare: string,
  recordTime?: Date
): Promise<any> {
  try {
    const result = await pool.query(
      `INSERT INTO maxdiff_history 
        (exchange_name, symbol, percent_difference, exchange_price, binance_price, volume, amount_irt, status_compare, record_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        exchangeName,
        symbol,
        percentDifference,
        exchangePrice,
        binancePrice,
        volume,
        amountIrt,
        statusCompare,
        recordTime || getTehranTimeAsDate()
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error(`❌ Error inserting maxdiff record for ${symbol}:`, error);
    return null;
  }
}

// function getTehranTime(): string {
//   const now = new Date();
//   const tehranTime = now.toLocaleString("en-US", { timeZone: "Asia/Tehran" });

//   return tehranTime;
// }

/**
 * وقت تهران را به صورت Date object برگردانید
 * @returns {Date} تاریخ و ساعت تهران
 */
function getTehranTimeAsDate(): Date {
  const now = new Date();
  // تهران UTC+3:30 است
  const tehranOffset = 3.5 * 60 * 60 * 1000;
  const utcOffset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() + utcOffset + tehranOffset);
}

/**
 * داده‌ها را برای دوره‌های مختلف دریافت کنید
 * @param {string} exchangeName - نام صرافی
 * @returns {Promise<object>} شامل timestamp، exchangeName، last24h، lastWeek، allTime
 */
async function getDataByPeriod(exchangeName: string): Promise<any> {
  try {
    // دریافت داده 24 ساعت گذشته
    const last24hResult = await pool.query(
      `SELECT * FROM maxdiff_history 
       WHERE exchange_name = $1 AND record_time > NOW() - INTERVAL '24 hours'
       ORDER BY record_time DESC;`,
      [exchangeName]
    );

    // دریافت داده هفت روز گذشته
    const lastWeekResult = await pool.query(
      `SELECT * FROM maxdiff_history 
       WHERE exchange_name = $1 AND record_time > NOW() - INTERVAL '7 days'
       ORDER BY record_time DESC;`,
      [exchangeName]
    );

    // دریافت تمام داده‌ها
    const allTimeResult = await pool.query(
      `SELECT * FROM maxdiff_history 
       WHERE exchange_name = $1
       ORDER BY record_time DESC;`,
      [exchangeName]
    );

    return {
      timestamp: getTehranTimeAsDate(),
      exchangeName: exchangeName,
      last24h: last24hResult.rows,
      lastWeek: lastWeekResult.rows,
      allTime: allTimeResult.rows
    };
  } catch (error) {
    console.error(`❌ Error fetching data by period for ${exchangeName}:`, error);
    return {
      timestamp: null,
      exchangeName: exchangeName || null,
      last24h: null,
      lastWeek: null,
      allTime: null
    };
  }
}

export {
  pool,
  ensureDatabase,
  initializeDatabase,
  registerExchange,
  insertMaxDiffRecord,
  getDataByPeriod
};