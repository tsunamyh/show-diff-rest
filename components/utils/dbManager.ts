import { Pool, QueryResult } from 'pg';

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

interface HistoryData {
  timestamp: string;
  exchangeName: string;
  last24h: CurrencyDiffTracker[];
  lastWeek: CurrencyDiffTracker[];
  allTime: CurrencyDiffTracker[];
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'arbitrage_db',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Initialize database tables
async function initializeDatabase(): Promise<void> {
  try {
    // Create table for arbitrage opportunities (last 24 hours)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        exchange_name VARCHAR(50),
        symbol VARCHAR(20),
        percent_difference DECIMAL(10, 2),
        exchange_price DECIMAL(20, 2),
        binance_price DECIMAL(20, 2),
        volume DECIMAL(20, 8),
        amount_irt DECIMAL(20, 2),
        status_compare VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create table for currency diff history (replaces file-based history)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS currency_diff_history (
        id SERIAL PRIMARY KEY,
        exchange_name VARCHAR(50),
        symbol VARCHAR(20),
        status_compare VARCHAR(20),
        max_difference DECIMAL(10, 2),
        record_time TIMESTAMP,
        record_value DECIMAL(10, 2),
        exchange_buy_price DECIMAL(20, 2),
        binance_sell_price DECIMAL(20, 2),
        buy_volume DECIMAL(20, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exchange_name) REFERENCES exchanges(name) ON DELETE CASCADE
      );
    `);

    // Create exchanges lookup table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchanges (
        name VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default exchanges
    await pool.query(`
      INSERT INTO exchanges (name) VALUES 
      ('wallex'), ('okex'), ('nobitex')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Create indexes for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_timestamp 
      ON arbitrage_opportunities(timestamp DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_symbol 
      ON arbitrage_opportunities(symbol);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_exchange 
      ON arbitrage_opportunities(exchange_name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_history_exchange_symbol
      ON currency_diff_history(exchange_name, symbol);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_history_created_at
      ON currency_diff_history(created_at DESC);
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Insert arbitrage opportunity record
async function insertArbitrageRecord(
  exchangeName: string,
  symbol: string,
  percentDifference: number,
  exchangePrice: number,
  binancePrice: number,
  volume: number,
  amountIrt: number,
  statusCompare: string
): Promise<QueryResult | null> {
  try {
    const result = await pool.query(
      `INSERT INTO arbitrage_opportunities 
        (exchange_name, symbol, percent_difference, exchange_price, binance_price, volume, amount_irt, status_compare)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [exchangeName, symbol, percentDifference, exchangePrice, binancePrice, volume, amountIrt, statusCompare]
    );
    return result;
  } catch (error) {
    console.error('❌ Error inserting arbitrage record:', error);
    return null;
  }
}

// Get last 24 hours of data
async function getLast24Hours(exchangeName?: string): Promise<any[]> {
  try {
    let query = `
      SELECT * FROM arbitrage_opportunities 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `;
    const params: any[] = [];

    if (exchangeName) {
      query += ` AND exchange_name = $1`;
      params.push(exchangeName);
    }

    query += ` ORDER BY timestamp DESC;`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching last 24 hours data:', error);
    return [];
  }
}

// Get top opportunities by percent difference (last 24 hours)
async function getTopOpportunities(limit: number = 10, exchangeName?: string): Promise<any[]> {
  try {
    let query = `
      SELECT 
        symbol,
        exchange_name,
        AVG(percent_difference) as avg_difference,
        MAX(percent_difference) as max_difference,
        COUNT(*) as occurrence_count,
        MAX(timestamp) as last_seen
      FROM arbitrage_opportunities
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `;
    const params: any[] = [];

    if (exchangeName) {
      query += ` AND exchange_name = $1`;
      params.push(exchangeName);
    }

    query += ` GROUP BY symbol, exchange_name
      ORDER BY max_difference DESC
      LIMIT $${params.length + 1};`;
    
    if (!exchangeName) {
      params.push(limit);
    } else {
      params.push(limit);
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching top opportunities:', error);
    return [];
  }
}

// Get statistics for last 24 hours
async function getStatistics(exchangeName?: string): Promise<any> {
  try {
    let query = `
      SELECT 
        exchange_name,
        COUNT(*) as total_records,
        AVG(percent_difference) as avg_difference,
        MAX(percent_difference) as max_difference,
        MIN(percent_difference) as min_difference,
        SUM(amount_irt) as total_volume_irt,
        COUNT(DISTINCT symbol) as unique_symbols
      FROM arbitrage_opportunities
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `;
    const params: any[] = [];

    if (exchangeName) {
      query += ` AND exchange_name = $1`;
      params.push(exchangeName);
    }

    query += ` GROUP BY exchange_name;`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    return [];
  }
}
// Close database connection
async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

// ============== HISTORY MANAGER FUNCTIONS ==============

// Save currency diff tracker to database (replaces file-based history)
async function saveHistoryToDatabase(
  exchange: 'wallex' | 'okex' | 'nobitex',
  tracker: Map<string, CurrencyDiffTracker>
): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete old records older than 30 days for this exchange
      await client.query(
        `DELETE FROM currency_diff_history 
         WHERE exchange_name = $1 AND created_at < NOW() - INTERVAL '30 days'`,
        [exchange]
      );

      // Insert new records
      for (const [symbol, data] of tracker.entries()) {
        for (const percentRecord of data.percentages) {
          await client.query(
            `INSERT INTO currency_diff_history 
              (exchange_name, symbol, status_compare, max_difference, record_time, record_value, 
               exchange_buy_price, binance_sell_price, buy_volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              exchange,
              symbol,
              data.statusCompare,
              data.maxDifference,
              new Date(percentRecord.time),
              percentRecord.value,
              percentRecord.exchangeBuyPrice || 0,
              percentRecord.binanceSellPrice || 0,
              percentRecord.buyVolume || 0
            ]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Saved ${exchange} history to database`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Error saving ${exchange} history to database:`, error);
  }
}

// Load history from database and reconstruct Map
async function loadHistoryFromDatabase(
  exchange: 'wallex' | 'okex' | 'nobitex'
): Promise<Map<string, CurrencyDiffTracker>> {
  try {
    const result = await pool.query(
      `SELECT * FROM currency_diff_history 
       WHERE exchange_name = $1 
       ORDER BY created_at DESC`,
      [exchange]
    );

    const map = new Map<string, CurrencyDiffTracker>();

    for (const row of result.rows) {
      if (!map.has(row.symbol)) {
        map.set(row.symbol, {
          symbol: row.symbol,
          statusCompare: row.status_compare,
          maxDifference: parseFloat(row.max_difference),
          percentages: []
        });
      }

      const tracker = map.get(row.symbol)!;
      tracker.percentages.push({
        time: new Date(row.record_time).toLocaleString('en-US', { timeZone: 'Asia/Tehran' }),
        value: parseFloat(row.record_value),
        exchangeBuyPrice: parseFloat(row.exchange_buy_price),
        binanceSellPrice: parseFloat(row.binance_sell_price),
        buyVolume: parseFloat(row.buy_volume)
      });
    }

    console.log(`✅ Loaded ${map.size} currencies from ${exchange} database history`);
    return map;
  } catch (error) {
    console.error(`❌ Error loading ${exchange} history from database:`, error);
    return new Map();
  }
}

// Get data by time period
async function getDataByPeriod(
  exchange: 'wallex' | 'okex' | 'nobitex'
): Promise<HistoryData> {
  try {
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Get last 24 hours data
    const last24hResult = await pool.query(
      `SELECT DISTINCT symbol, status_compare, MAX(max_difference) as max_diff
       FROM currency_diff_history
       WHERE exchange_name = $1 AND created_at > NOW() - INTERVAL '24 hours'
       GROUP BY symbol, status_compare
       ORDER BY max_diff DESC
       LIMIT 10`,
      [exchange]
    );

    // Get last week data
    const lastWeekResult = await pool.query(
      `SELECT DISTINCT symbol, status_compare, MAX(max_difference) as max_diff
       FROM currency_diff_history
       WHERE exchange_name = $1 AND created_at > NOW() - INTERVAL '7 days'
       GROUP BY symbol, status_compare
       ORDER BY max_diff DESC
       LIMIT 10`,
      [exchange]
    );

    // Get all-time data
    const allTimeResult = await pool.query(
      `SELECT DISTINCT symbol, status_compare, MAX(max_difference) as max_diff
       FROM currency_diff_history
       WHERE exchange_name = $1
       GROUP BY symbol, status_compare
       ORDER BY max_diff DESC
       LIMIT 10`,
      [exchange]
    );

    const formatResults = (rows: any[]): CurrencyDiffTracker[] => {
      return rows.map(row => ({
        symbol: row.symbol,
        statusCompare: row.status_compare,
        maxDifference: parseFloat(row.max_diff),
        percentages: []
      }));
    };

    return {
      timestamp: new Date().toISOString(),
      exchangeName: exchange,
      last24h: formatResults(last24hResult.rows),
      lastWeek: formatResults(lastWeekResult.rows),
      allTime: formatResults(allTimeResult.rows)
    };
  } catch (error) {
    console.error(`❌ Error fetching ${exchange} data by period:`, error);
    return {
      timestamp: new Date().toISOString(),
      exchangeName: exchange,
      last24h: [],
      lastWeek: [],
      allTime: []
    };
  }
}

// Get top opportunities by percent difference
async function getTopOpportunitiesByPeriod(
  exchange: 'wallex' | 'okex' | 'nobitex',
  period: 'last24h' | 'lastWeek' | 'allTime' = 'last24h'
): Promise<CurrencyDiffTracker[]> {
  try {
    let intervalClause = "NOW() - INTERVAL '24 hours'";
    if (period === 'lastWeek') {
      intervalClause = "NOW() - INTERVAL '7 days'";
    }
    // for allTime, no interval clause needed

    const query = period === 'allTime'
      ? `SELECT DISTINCT ON (symbol) symbol, status_compare, max_difference, percentages
         FROM (
           SELECT symbol, status_compare, max_difference,
                  jsonb_agg(jsonb_build_object(
                    'time', record_time,
                    'value', record_value,
                    'exchangeBuyPrice', exchange_buy_price,
                    'binanceSellPrice', binance_sell_price,
                    'buyVolume', buy_volume
                  ) ORDER BY created_at DESC LIMIT 10) as percentages
           FROM currency_diff_history
           WHERE exchange_name = $1
           GROUP BY symbol, status_compare, max_difference
         ) sub
         ORDER BY symbol, max_difference DESC
         LIMIT 10`
      : `SELECT DISTINCT ON (symbol) symbol, status_compare, max_difference, percentages
         FROM (
           SELECT symbol, status_compare, max_difference,
                  jsonb_agg(jsonb_build_object(
                    'time', record_time,
                    'value', record_value,
                    'exchangeBuyPrice', exchange_buy_price,
                    'binanceSellPrice', binance_sell_price,
                    'buyVolume', buy_volume
                  ) ORDER BY created_at DESC LIMIT 10) as percentages
           FROM currency_diff_history
           WHERE exchange_name = $1 AND created_at > ${intervalClause}
           GROUP BY symbol, status_compare, max_difference
         ) sub
         ORDER BY symbol, max_difference DESC
         LIMIT 10`;

    const result = await pool.query(query, [exchange]);

    return result.rows.map(row => ({
      symbol: row.symbol,
      statusCompare: row.status_compare,
      maxDifference: parseFloat(row.max_difference),
      percentages: row.percentages || []
    }));
  } catch (error) {
    console.error(`❌ Error fetching top opportunities:`, error);
    return [];
  }
}

// Get statistics for a time period
async function getStatisticsByPeriod(
  exchange: 'wallex' | 'okex' | 'nobitex',
  period: 'last24h' | 'lastWeek' | 'allTime' = 'last24h'
): Promise<any> {
  try {
    let intervalClause = "created_at > NOW() - INTERVAL '24 hours'";
    if (period === 'lastWeek') {
      intervalClause = "created_at > NOW() - INTERVAL '7 days'";
    }
    // for allTime, no interval clause needed
    const whereClause = period === 'allTime'
      ? `WHERE exchange_name = $1`
      : `WHERE exchange_name = $1 AND ${intervalClause}`;

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT symbol) as unique_symbols,
        AVG(CAST(record_value as FLOAT)) as avg_difference,
        MAX(CAST(max_difference as FLOAT)) as max_difference,
        MIN(CAST(record_value as FLOAT)) as min_difference,
        SUM(CAST(buy_volume as FLOAT)) as total_volume
       FROM currency_diff_history
       ${whereClause}`,
      [exchange]
    );

    return result.rows[0] || {};
  } catch (error) {
    console.error(`❌ Error fetching statistics:`, error);
    return {};
  }
}

// Clean old records (older than specified days)
async function cleanOldRecords(daysOld: number = 30): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM currency_diff_history 
       WHERE created_at < NOW() - INTERVAL '${daysOld} days'`
    );
    console.log(`🧹 Cleaned ${result.rowCount} old records`);
    return result.rowCount || 0;
  } catch (error) {
    console.error('❌ Error cleaning old records:', error);
    return 0;
  }
}

export {
  pool,
  initializeDatabase,
  insertArbitrageRecord,
  getLast24Hours,
  getTopOpportunities,
  getStatistics,
  cleanOldRecords,
  closeDatabase,
  saveHistoryToDatabase,
  loadHistoryFromDatabase,
  getDataByPeriod,
  getTopOpportunitiesByPeriod,
  getStatisticsByPeriod
};

export type { CurrencyDiffTracker, PercentageRecord, HistoryData };
