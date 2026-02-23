let Pool: any = null;
let isDbAvailable = false;

// Try to load pg module - if not available, database features will be disabled
try {
  const pgModule = require('pg');
  Pool = pgModule.Pool;
  isDbAvailable = true;
} catch (error: any) {
  console.warn('⚠️  pg module not available - database features disabled');
  isDbAvailable = false;
}

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
  period_type?: PeriodType;
  difference: number;
  exchange_ask_tmn: string; // exchange_buy_price?: number;
  exchange_ask_usdt?: string;
  exchange_quantity_tmn: string;  //buy_volume_tmn?: number;
  exchange_quantity_usdt?: string;  //buy_volume_tmn?: number;
  binance_ask_tmn: string;
  binance_ask_usdt?: string;
  my_percent: string;
  spread: string;  //askBidDifferencePercentInevery exchange
  last_updated?: string;
  description?: string;
  exchange_quantity_currency?: string;
}

interface OpenOrder extends CurrencyDiffTracker {
  binance_bid_tmn: string;
  binance_bid_usdt: string;
  exchange_bid_tmn: string;
  exchange_bid_usdt?: string;
  order_id?: string;
  max_loss_percent?: string;
  status_position?: string;
}

// یک Pool برای postgres بیس (برای ساخت دیتابیس) - صرف اگر available باشد
const adminPool = isDbAvailable ? new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres',  // اتصال به postgres default database
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
}) : null;

// Pool اصلی برای اتصال به دیتابیس ما - بطور تنبل اولیه سازی می شود
let pool: any = null;

function initializePool() {
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

function getPool() {
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
  if (!isDbAvailable) {
    console.warn('⚠️  Database not available (pg module not installed)');
    return;
  }

  const dbName = process.env.DB_NAME || 'maxdiff_db';
  try {
    console.log(`🔍 Checking if database "${dbName}" exists...`);
    await adminPool!.query(`CREATE DATABASE ${dbName};`);
    console.log(`✅ Database "${dbName}" created successfully`);
  } catch (error: any) {
    // بررسی خطاهای اتصال
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error(`❌ Cannot connect to PostgreSQL server: ${error.message}`);
      console.error(`   Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
      console.warn('⚠️  Setting database to unavailable mode');
      isDbAvailable = false;
      throw error; // retry will handle this
    } else if (error.code === '42P04') {
      console.log(`✅ Database "${dbName}" already exists`);
    } else {
      console.error("❌ Unexpected database error =>", error.message);
      throw error;
    }
  } finally {
    if (adminPool) {
      try {
        await adminPool.end();
      } catch (error: any) {
        // Ignore pool end errors
      }
    }
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
  if (!isDbAvailable) {
    console.warn('⚠️  Database not available (pg module not installed)');
    return;
  }

  try {
    console.log('📦 Initializing database...');

    // Create single price_checks table
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS price_checks (
        id BIGSERIAL PRIMARY KEY,
        exchange_name VARCHAR(50) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        status_compare VARCHAR(50) NOT NULL,
        period_type VARCHAR(50) NOT NULL,
        difference NUMERIC(20, 8) NOT NULL,
        exchange_ask_tmn VARCHAR(100),
        exchange_ask_usdt VARCHAR(100),
        exchange_quantity_tmn VARCHAR(100),
        exchange_quantity_usdt VARCHAR(100),
        exchange_quantity_currency VARCHAR(100),
        binance_ask_tmn VARCHAR(100),
        binance_ask_usdt VARCHAR(100),
        my_percent VARCHAR(100),
        spread VARCHAR(100),
        description TEXT,
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(exchange_name, symbol, period_type, status_compare)
      );
    `);

    // Create open_orders table for tracking active buy/sell orders
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS open_orders (
        id BIGSERIAL PRIMARY KEY,
        exchange_name VARCHAR(20) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        status_compare VARCHAR(10) NOT NULL,
        period_type VARCHAR(50) NOT NULL,
        difference NUMERIC(20, 8) NOT NULL,
        exchange_ask_tmn VARCHAR(20),
        exchange_ask_usdt VARCHAR(20),
        exchange_quantity_tmn VARCHAR(20),
        exchange_quantity_usdt VARCHAR(20),
        binance_ask_tmn VARCHAR(20),
        binance_ask_usdt VARCHAR(20),
        my_percent VARCHAR(10),
        spread VARCHAR(10),
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        exchange_quantity_currency VARCHAR(20),
        binance_bid_tmn VARCHAR(20),
        binance_bid_usdt VARCHAR(20),
        exchange_bid_tmn VARCHAR(20),
        exchange_bid_usdt VARCHAR(20),
        order_id VARCHAR(100) NOT NULL,
        max_loss_percent VARCHAR(10),
        status_position VARCHAR(10),

        UNIQUE(exchange_name, order_id)
      );
    `);

    // Create indexes
    await getPool().query(`
      CREATE INDEX IF NOT EXISTS idx_price_checks_exchange_period_time 
      ON price_checks(exchange_name, period_type, last_updated DESC);
    `);

    await getPool().query(`
      CREATE INDEX IF NOT EXISTS idx_price_checks_lookup
      ON price_checks(exchange_name, period_type, symbol);
    `);

    await getPool().query(`
      CREATE INDEX IF NOT EXISTS idx_open_orders_exchange
      ON open_orders(exchange_name, status);
    `);

    await getPool().query(`
      CREATE INDEX IF NOT EXISTS idx_open_orders_symbol
      ON open_orders(symbol, status);
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

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
 * داده‌های سفارشات را برای صرافی مخصوص دریافت کنید
 * @param {string} exchange - نام صرافی
 * @returns {Promise<object>} شامل active, closed, cancelled orders
 */
async function loadAllOrdersByExchangeName(
  exchange: 'wallex' | 'okex' | 'nobitex'
): Promise<OpenOrder[]> {
  let result: OpenOrder[] = [];
  if (!isDbAvailable) {
    console.warn(`⚠️  Database not available - returning empty data for ${exchange}`);
    return result;
  }

  try {
    // دریافت تمام سفارشات از جدول open_orders
    const rows = await getPool().query(
      `SELECT * FROM open_orders 
       WHERE exchange_name = $1
       ORDER BY status, created_at DESC;`,
      [exchange]
    );
    result = [...rows.rows as OpenOrder[]];
    // result.push(...(rows.rows as OpenOrder[]));

    console.log(`✅ Loaded ${exchange} open orders from open_orders table`);
    return result;
  } catch (error) {
    console.error(`❌ Error loading orders for ${exchange}:`, error);
    return result;
  }
}

/**
 * داده‌ها را برای دوره‌های مختلف دریافت کنید - فقط records در محدوده زمانی
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

  if (!isDbAvailable) {
    console.warn(`⚠️  Database not available - returning empty data for ${exchange}`);
    return result;
  }

  try {
    // دریافت تمام داده‌ها از جدول price_checks
    const rows = await getPool().query(
      `SELECT * FROM price_checks 
       WHERE exchange_name = $1
       ORDER BY period_type, difference DESC, last_updated DESC;`,
      [exchange]
    );

    const now = Date.now();

    // تقسیم داده‌ها براساس period_type و محدوده زمانی
    for (const row of rows.rows as CurrencyDiffTracker[]) {
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
          exchange_ask_tmn: row.exchange_ask_tmn || undefined,
          exchange_ask_usdt: row.exchange_ask_usdt || undefined,
          exchange_quantity_tmn: row.exchange_quantity_tmn || undefined,
          exchange_quantity_usdt: row.exchange_quantity_usdt || undefined,
          exchange_quantity_currency: row.exchange_quantity_currency || undefined,
          binance_ask_tmn: row.binance_ask_tmn || undefined,
          binance_ask_usdt: row.binance_ask_usdt || undefined,
          my_percent: row.my_percent || undefined,
          spread: row.spread || undefined,
          description: row.description || undefined,
          last_updated: row.last_updated
        });
      }
    }

    console.log(`✅ Loaded ${exchange} data from price_checks (with time filtering)`);
    return result;
  } catch (error) {
    console.error(`❌ Error loading data for ${exchange}:`, error);
    return result;
  }
}

/**
 * Save OpenOrder data to open_orders table
 * @param {string} exchange - exchange name (wallex, okex, nobitex)
 * @param {OpenOrder} order - order data with all fields
 * @returns {Promise<boolean>} true if successful
 */
async function saveOrdersToDatabase(
  exchange: 'wallex' | 'okex' | 'nobitex',
  order: OpenOrder
): Promise<boolean> {
  try {
    // Check if database is available
    if (!isDbAvailable) {
      console.warn(`⚠️  Database not available - skipping save for ${exchange}`);
      return false;
    }

    // Check if pool is initialized
    if (!pool) {
      console.warn(`⚠️  Database pool not initialized. Skipping save for ${exchange}`);
      return false;
    }

    await getPool().query(
      `INSERT INTO open_orders 
          (exchange_name, symbol, status_compare, period_type, difference,
          exchange_ask_tmn, exchange_ask_usdt, exchange_quantity_tmn,
          exchange_quantity_usdt, binance_ask_tmn, binance_ask_usdt, 
          my_percent, spread, last_updated, description, 
          exchange_quantity_currency, binance_bid_tmn,
          binance_bid_usdt, exchange_bid_tmn, exchange_bid_usdt
          order_id, max_loss_percent, status_position)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                  $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT DO NOTHING;`,
      [
        exchange,
        order.symbol,
        order.status_compare,
        order.period_type,
        order.difference,
        order.exchange_ask_tmn ?? null,
        order.exchange_ask_usdt ?? null,
        order.exchange_quantity_tmn ?? null,
        order.exchange_quantity_usdt ?? null,
        order.binance_ask_tmn ?? null,
        order.binance_ask_usdt ?? null,
        order.my_percent ?? null,
        order.spread ?? null,
        order.last_updated ?? new Date().toISOString(),
        order.description ?? null,
        order.exchange_quantity_currency ?? null,
        order.binance_bid_tmn ?? null,
        order.binance_bid_usdt ?? null,
        order.exchange_bid_tmn ?? null,
        order.exchange_bid_usdt ?? null,
        order.order_id ?? null,
        order.max_loss_percent ?? null,
        order.status_position ?? null
      ]
    );

    console.log(`✅ Saved ${exchange} order to open_orders (upserted)`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving order for ${exchange}:`, error);
    return false;
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
    // Check if database is available
    if (!isDbAvailable) {
      console.warn(`⚠️  Database not available - skipping save for ${exchange}`);
      return false;
    }

    // Check if pool is initialized
    if (!pool) {
      console.warn(`⚠️  Database pool not initialized. Skipping save for ${exchange}`);
      return false;
    }
    // console.log("5:>>",[...trackerByPeriod.last1h.values()][0])
    const periods = Object.values(PeriodType);
    const periodIntervals: { [key in PeriodType]: string } = {
      [PeriodType.last1h]: "1 hour",
      [PeriodType.last24h]: "24 hours",
      [PeriodType.lastWeek]: "7 days",
      [PeriodType.allTime]: "100 years" // basically never delete allTime
    };

    // Delete old records for each period first
    for (const period of periods) {
      const interval = periodIntervals[period as PeriodType];
      await getPool().query(
        `DELETE FROM price_checks
         WHERE exchange_name = $1
         AND period_type = $2
         AND last_updated < NOW() - INTERVAL '${interval}';`,
        [exchange, period]
      );
      // console.log("deleteee :",rows.rows);

    }

    // Then UPSERT new/updated records
    for (const period of periods) {
      const trackerMap = trackerByPeriod[period as keyof typeof trackerByPeriod];
      if (!trackerMap || trackerMap.size === 0) continue;

      for (const [symbol, record] of trackerMap.entries()) {
        await getPool().query(
          `INSERT INTO price_checks 
          (exchange_name, symbol, status_compare, period_type, difference,
          exchange_ask_tmn, exchange_ask_usdt,
          binance_ask_tmn, binance_ask_usdt, my_percent,
          spread, exchange_quantity_tmn, exchange_quantity_usdt, exchange_quantity_currency,
          description, last_updated)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (exchange_name, symbol, period_type, status_compare)
          DO UPDATE SET
          difference = EXCLUDED.difference,
          exchange_ask_tmn = EXCLUDED.exchange_ask_tmn,
          exchange_ask_usdt = EXCLUDED.exchange_ask_usdt,
          binance_ask_tmn = EXCLUDED.binance_ask_tmn,
          binance_ask_usdt = EXCLUDED.binance_ask_usdt,
          my_percent = EXCLUDED.my_percent,
          spread = EXCLUDED.spread,
          exchange_quantity_tmn = EXCLUDED.exchange_quantity_tmn,
          exchange_quantity_usdt = EXCLUDED.exchange_quantity_usdt,
          exchange_quantity_currency = EXCLUDED.exchange_quantity_currency,
          description = EXCLUDED.description,
          last_updated = EXCLUDED.last_updated;`,
          [
            exchange,
            record.symbol,
            record.status_compare,
            record.period_type,
            record.difference,
            record.exchange_ask_tmn ?? null,
            record.exchange_ask_usdt ?? null,
            record.binance_ask_tmn ?? null,
            record.binance_ask_usdt ?? null,
            record.my_percent ?? null,
            record.spread ?? null,
            record.exchange_quantity_tmn ?? null,
            record.exchange_quantity_usdt ?? null,
            record.exchange_quantity_currency ?? null,
            record.description ?? null,
            record.last_updated
          ]
        );
      }
    }

    console.log(`✅ Saved ${exchange} to price_checks (old data removed, new data upserted)`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving tracker for ${exchange}:`, error);
    return false;
  }
}

async function getDataByExchangename(exchange: 'wallex' | 'nobitex' | 'okex') {
  let result = await loadAllDataByExchangeName(exchange)

  return {
    exchangeName: exchange,
    last1h: [...result.last1h.values()],
    last24h: [...result.last24h.values()],
    lastWeek: [...result.lastWeek.values()],
    allTime: [...result.allTime.values()]
  }
}

function getDbStatus() {
  return {
    available: isDbAvailable,
    mode: isDbAvailable ? 'normal' : 'degraded'
  };
}

export {
  PeriodType,
  CurrencyDiffTracker,
  OpenOrder,
  getPool,
  ensureDatabase,
  initializeDatabase,
  saveTrackerToDatabase,
  loadAllDataByExchangeName,
  loadAllOrdersByExchangeName,
  getDataByExchangename,
  getDbStatus
};