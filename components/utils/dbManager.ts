import { Pool } from 'pg';

enum PeriodType {
  last1h = 'last1h',
  last24h = 'last24h',
  lastWeek = 'lastWeek',
  allTime = 'allTime'
}

interface CurrencyDiffTracker {
  id?: number;
  exchange_name: string;
  symbol: string;
  status_compare: string;
  period_type: PeriodType;
  difference: number;
  exchange_buy_price?: number;
  binance_sell_price?: number;
  buy_volume_tmn?: number;
  record_time: string;
}

// یک Pool برای postgres بیس (برای ساخت دیتابیس)
const adminPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres',  // اتصال به postgres default database
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Pool اصلی برای اتصال به دیتابیس ما - بطور تنبل اولیه سازی می شود
let pool: Pool | null = null;

function initializePool(): Pool {
  if (!pool) {
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'maxdiff_db',
      password: process.env.DB_PASSWORD || '123456',
      port: parseInt(process.env.DB_PORT || '5432'),
    });
  }
  return pool;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase first.');
  }
  return pool;
}

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
      console.log("throw error =>", error)
      throw error;
    }
  } finally {
    await adminPool.end();
  }
  
  // بعد از ایجاد دیتابیس، pool را اولیه سازی کنید
  initializePool();
}

/**
 * دیتابیس را شروع کنید - فقط 2 جدول اصلی
 * @returns {Promise<void>}
 * @throws {Error} اگر ایجاد جدول ناموفق باشد
 */
async function initializeDatabase(): Promise<void> {
  try {
    console.log('📦 Initializing database...');

    // Create single price_checks table
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS price_checks (
        id BIGSERIAL PRIMARY KEY,
        exchange_name VARCHAR(50) NOT NULL,
        period_type VARCHAR(20) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        status_compare VARCHAR(20) NOT NULL,
        difference DECIMAL(10, 2),
        exchange_buy_price DECIMAL(20, 2),
        binance_sell_price DECIMAL(20, 2),
        buy_volume_tmn DECIMAL(20, 8),
        record_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(exchange_name, symbol, period_type, DATE(record_time))
      );
    `);

    // Create indexes
    await getPool().query(`
      CREATE INDEX IF NOT EXISTS idx_price_checks_exchange_period_time 
      ON price_checks(exchange_name, period_type, record_time DESC);
    `);

    await getPool().query(`
      CREATE INDEX IF NOT EXISTS idx_price_checks_lookup
      ON price_checks(exchange_name, period_type, symbol);
    `);

    console.log('✅ Database initialized successfully');
    console.log('📊 Table: price_checks');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Insert maxdiff record into history
// async function insertMaxDiffRecord(
//   exchangeName: string,
//   symbol: string,
//   percentDifference: number,
//   exchangePrice: number,
//   binancePrice: number,
//   volume: number,
//   amountIrt: number,
//   statusCompare: string,
//   recordTime?: Date
// ): Promise<any> {
//   try {
//     const result = await pool.query(
//       `INSERT INTO maxdiff_history 
//         (exchange_name, symbol, percent_difference, exchange_price, binance_price, volume, amount_irt, status_compare, record_time)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
//        RETURNING *;`,
//       [
//         exchangeName,
//         symbol,
//         percentDifference,
//         exchangePrice,
//         binancePrice,
//         volume,
//         amountIrt,
//         statusCompare,
//         recordTime || getTehranTimeAsDate()
//       ]
//     );

//     return result.rows[0];
//   } catch (error) {
//     console.error(`❌ Error inserting maxdiff record for ${symbol}:`, error);
//     return null;
//   }
// }

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
 * @param {string} exchange - نام صرافی
 * @returns {Promise<object>} شامل last1h، last24h، lastWeek، allTime
 */
async function loadAllDataByExchangeName(
  exchange: 'wallex' | 'okex' | 'nobitex'
): Promise<{
  last1h: Map<string, CurrencyDiffTracker>;
  last24h: Map<string, CurrencyDiffTracker>;
  lastWeek: Map<string, CurrencyDiffTracker>;
  allTime: Map<string, CurrencyDiffTracker>;
}> {
  const result = {
    last1h: new Map<string, CurrencyDiffTracker>(),
    last24h: new Map<string, CurrencyDiffTracker>(),
    lastWeek: new Map<string, CurrencyDiffTracker>(),
    allTime: new Map<string, CurrencyDiffTracker>()
  };

  try {
    // دریافت تمام داده‌ها از جدول price_checks
    const rows = await getPool().query(
      `SELECT * FROM price_checks 
       WHERE exchange_name = $1
       ORDER BY period_type, difference DESC, record_time DESC;`,
      [exchange]
    );

    // تقسیم داده‌ها براساس period_type
    for (const row of rows.rows) {
      const periodType = row.period_type as PeriodType;
      const map = result[periodType];

      // اگر symbol قبلاً ثبت نشده است، آن را اضافه کنید
      if (!map.has(row.symbol)) {
        map.set(row.symbol, {
          id: row.id,
          exchange_name: row.exchange_name,
          symbol: row.symbol,
          status_compare: row.status_compare,
          period_type: periodType,
          difference: Number(row.difference),
          exchange_buy_price: row.exchange_buy_price ? Number(row.exchange_buy_price) : undefined,
          binance_sell_price: row.binance_sell_price ? Number(row.binance_sell_price) : undefined,
          buy_volume_tmn: row.buy_volume_tmn ? Number(row.buy_volume_tmn) : undefined,
          record_time: row.record_time.toISOString()
        });
      }
    }

    console.log(`✅ Loaded ${exchange} data from price_checks`);
    return result;
  } catch (error) {
    console.error(`❌ Error loading data for ${exchange}:`, error);
    return result;
  }
}


/**
 * Tracker داده‌ها را به جدول price_checks ذخیره کنید
 * @param {string} exchange - نام صرافی (wallex, okex, nobitex)
 * @param {object} trackerByPeriod - شامل last1h, last24h, lastWeek, allTime
 * @returns {Promise<boolean>} true اگر موفق باشد
 */
async function saveTrackerToDatabase(
  exchange: 'wallex' | 'okex' | 'nobitex',
  trackerByPeriod: {
    last1h?: Map<string, CurrencyDiffTracker>;
    last24h?: Map<string, CurrencyDiffTracker>;
    lastWeek?: Map<string, CurrencyDiffTracker>;
    allTime?: Map<string, CurrencyDiffTracker>;
  }
): Promise<boolean> {
  try {
    // ۱- حذف تمام داده‌های قدیمی این صرافی
    await getPool().query(
      `DELETE FROM price_checks WHERE exchange_name = $1;`,
      [exchange]
    );

    // ۲- ذخیره داده‌های جدید از تمام periods
    const periods = Object.values(PeriodType);
    
    for (const period of periods) {
      const trackerMap = trackerByPeriod[period as keyof typeof trackerByPeriod];
      if (!trackerMap || trackerMap.size === 0) continue;

      for (const [symbol, record] of trackerMap.entries()) {
        await getPool().query(
          `INSERT INTO price_checks 
           (exchange_name, symbol, status_compare, period_type, difference,
            exchange_buy_price, binance_sell_price, buy_volume_tmn, record_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
          [
            exchange,
            record.symbol,
            record.status_compare,
            record.period_type,
            record.difference,
            record.exchange_buy_price ?? null,
            record.binance_sell_price ?? null,
            record.buy_volume_tmn ?? null,
            record.record_time
          ]
        );
      }
    }

    console.log(`✅ Saved ${exchange} to price_checks`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving tracker for ${exchange}:`, error);
    return false;
  }
}


export {
  PeriodType,
  type CurrencyDiffTracker,
  getPool,
  ensureDatabase,
  initializeDatabase,
  saveTrackerToDatabase,
  loadAllDataByExchangeName
};