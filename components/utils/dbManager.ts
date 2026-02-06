import { Pool } from 'pg';

interface PercentageRecord {
    time: string;
    value: number;
    exchangeBuyPrice?: number;
    binanceSellPrice?: number;
    buyVolume?: number;
}

interface CurrencyDiffTracker {
    symbol: string;
    statusCompare: string;
    maxDifference: number;
    percentages: PercentageRecord[];
}

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
 * دیتابیس را شروع کنید - جداول جدید برای snapshot pattern
 * @returns {Promise<void>}
 * @throws {Error} اگر ایجاد جدول ناموفق باشد
 */
async function initializeDatabase(): Promise<void> {
  try {
    console.log('📦 Initializing database...');

    // Step 1: Create exchanges table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchanges (
        name VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Step 2: Create price_snapshots table (ذخیره snapshot‌های دوره‌ای)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_snapshots (
        id BIGSERIAL PRIMARY KEY,
        exchange_name VARCHAR(50) NOT NULL,
        period_type VARCHAR(20) NOT NULL,    -- 'last24h', 'lastWeek', 'allTime'
        snapshot_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_snapshot_exchange 
          FOREIGN KEY (exchange_name) 
          REFERENCES exchanges(name) 
          ON DELETE CASCADE,
        
        UNIQUE(exchange_name, period_type, snapshot_time)
      );
    `);

    // Step 3: Create price_symbols table (سمبل‌های هر snapshot)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_symbols (
        id BIGSERIAL PRIMARY KEY,
        snapshot_id BIGINT NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        status_compare VARCHAR(20) NOT NULL,
        max_difference DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_symbol_snapshot 
          FOREIGN KEY (snapshot_id) 
          REFERENCES price_snapshots(id) 
          ON DELETE CASCADE
      );
    `);

    // Step 4: Create price_percentages table (percentages بدون محدودیت)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_percentages (
        id BIGSERIAL PRIMARY KEY,
        symbol_id BIGINT NOT NULL,
        
        record_time TIMESTAMP NOT NULL,
        value DECIMAL(10, 2),
        exchange_buy_price DECIMAL(20, 2),
        binance_sell_price DECIMAL(20, 2),
        buy_volume DECIMAL(20, 8),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_percentage_symbol 
          FOREIGN KEY (symbol_id) 
          REFERENCES price_symbols(id) 
          ON DELETE CASCADE
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_snapshot_exchange_period 
      ON price_snapshots(exchange_name, period_type);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_symbol_snapshot 
      ON price_symbols(snapshot_id, symbol);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_percentage_symbol_time 
      ON price_percentages(symbol_id, record_time DESC);
    `);

    console.log('✅ Database initialized successfully');
    console.log('📊 Tables created: price_snapshots, price_symbols, price_percentages');
    console.log('⚠️ Percentages can grow unlimited, new 5 records will be added properly');
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

/**
 * Tracker Map را به دیتابیس ذخیره کنید - snapshot format
 * @param {string} exchange - نام صرافی (wallex, okex, nobitex)
 * @param {Map} tracker - Map<symbol, CurrencyDiffTracker>
 * @param {string} periodType - نوع دوره ('last24h', 'lastWeek', 'allTime')
 * @param {number} symbolLimit - حداکثر تعداد سمبل (10 یا 50)
 * @returns {Promise<boolean>} true اگر موفق باشد
 */
async function saveTrackerToDatabase(
  exchange: 'wallex' | 'okex' | 'nobitex',
  tracker: Map<string, CurrencyDiffTracker>,
  periodType: 'last24h' | 'lastWeek' | 'allTime' = 'last24h',
  symbolLimit: number = 10
): Promise<boolean> {
  try {
    // ۱. Snapshot ایجاد کن
    const snapshotResult = await pool.query(
      `INSERT INTO price_snapshots (exchange_name, period_type, snapshot_time)
       VALUES ($1, $2, NOW())
       RETURNING id;`,
      [exchange, periodType]
    );

    const snapshotId = snapshotResult.rows[0].id;

    // ۲. تمام symbols را sort کن و top N تا بگیر
    const sortedSymbols = Array.from(tracker.entries())
      .sort((a, b) => b[1].maxDifference - a[1].maxDifference)
      .slice(0, symbolLimit);

    // ۳. هر symbol را insert کن
    for (const [symbol, currencyData] of sortedSymbols) {
      const symbolResult = await pool.query(
        `INSERT INTO price_symbols (snapshot_id, symbol, status_compare, max_difference)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [snapshotId, symbol, currencyData.statusCompare, currencyData.maxDifference]
      );

      const symbolId = symbolResult.rows[0].id;

      // ۴. تمام percentages را insert کن (بدون محدودیت)
      if (currencyData.percentages && currencyData.percentages.length > 0) {
        for (const record of currencyData.percentages) {
          await pool.query(
            `INSERT INTO price_percentages 
             (symbol_id, record_time, value, exchange_buy_price, binance_sell_price, buy_volume)
             VALUES ($1, $2, $3, $4, $5, $6);`,
            [
              symbolId,
              new Date(record.time),
              record.value,
              record.exchangeBuyPrice || 0,
              record.binanceSellPrice || 0,
              record.buyVolume || 0
            ]
          );
        }
      }
    }

    console.log(`✅ Saved snapshot for ${exchange} (${periodType}) with ${sortedSymbols.length} symbols`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving tracker snapshot for ${exchange}:`, error);
    return false;
  }
}

export {
  pool,
  ensureDatabase,
  initializeDatabase,
  registerExchange,
  insertMaxDiffRecord,
  saveTrackerToDatabase,
  getDataByPeriod
};