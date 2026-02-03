import { Pool, QueryResult } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'arbitrage_db',
  password: process.env.DB_PASSWORD || '123456',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Initialize database tables and schema
async function initializeDatabase(): Promise<void> {
  try {
    console.log('📦 Initializing database...');

    // Create exchanges table (lookup table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchanges (
        name VARCHAR(50) PRIMARY KEY,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default exchanges
    await pool.query(`
      INSERT INTO exchanges (name, description) VALUES 
      ('wallex', 'Wallex Exchange'),
      ('okex', 'OKEx Exchange'),
      ('nobitex', 'Nobitex Exchange')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Create main arbitrage history table (یک جدول برای همه صرافی‌ها)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_history (
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
        CONSTRAINT fk_exchange 
          FOREIGN KEY (exchange_name) 
          REFERENCES exchanges(name) 
          ON DELETE CASCADE
      );
    `);

    // Create indexes برای سرعت query
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_history_exchange_time 
      ON arbitrage_history(exchange_name, record_time DESC)
      WHERE record_time > NOW() - INTERVAL '60 days';
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_history_symbol_time 
      ON arbitrage_history(symbol, record_time DESC)
      WHERE record_time > NOW() - INTERVAL '60 days';
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_history_created_at 
      ON arbitrage_history(created_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_history_percent 
      ON arbitrage_history(exchange_name, percent_difference DESC);
    `);

    // Create view برای last 24 hours
    await pool.query(`
      CREATE OR REPLACE VIEW arbitrage_last_24h AS
      SELECT * FROM arbitrage_history
      WHERE record_time > NOW() - INTERVAL '24 hours'
      ORDER BY record_time DESC;
    `);

    // Create view برای last 7 days
    await pool.query(`
      CREATE OR REPLACE VIEW arbitrage_last_7d AS
      SELECT * FROM arbitrage_history
      WHERE record_time > NOW() - INTERVAL '7 days'
      ORDER BY record_time DESC;
    `);

    // Create view برای last 60 days
    await pool.query(`
      CREATE OR REPLACE VIEW arbitrage_last_60d AS
      SELECT * FROM arbitrage_history
      WHERE record_time > NOW() - INTERVAL '60 days'
      ORDER BY record_time DESC;
    `);

    // Create table برای top opportunities (cache)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS top_opportunities (
        id SERIAL PRIMARY KEY,
        exchange_name VARCHAR(50) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        max_difference DECIMAL(10, 2),
        occurrences INT,
        last_seen TIMESTAMP,
        period VARCHAR(10),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_exchange_top 
          FOREIGN KEY (exchange_name) 
          REFERENCES exchanges(name) 
          ON DELETE CASCADE
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_top_exchange_period 
      ON top_opportunities(exchange_name, period);
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Insert arbitrage record into history
async function insertArbitrageRecord(
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
      `INSERT INTO arbitrage_history 
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
        recordTime || new Date()
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error inserting arbitrage record:', error);
    return null;
  }
}

// Get data for last 24 hours
async function getLast24Hours(exchangeName?: string): Promise<any[]> {
  try {
    let query = `SELECT * FROM arbitrage_last_24h`;
    const params: any[] = [];

    if (exchangeName) {
      query += ` WHERE exchange_name = $1`;
      params.push(exchangeName);
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching last 24 hours:', error);
    return [];
  }
}

// Get data for last 7 days
async function getLast7Days(exchangeName?: string): Promise<any[]> {
  try {
    let query = `SELECT * FROM arbitrage_last_7d`;
    const params: any[] = [];

    if (exchangeName) {
      query += ` WHERE exchange_name = $1`;
      params.push(exchangeName);
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching last 7 days:', error);
    return [];
  }
}

// Get data for last 60 days
async function getLast60Days(exchangeName?: string): Promise<any[]> {
  try {
    let query = `SELECT * FROM arbitrage_last_60d`;
    const params: any[] = [];

    if (exchangeName) {
      query += ` WHERE exchange_name = $1`;
      params.push(exchangeName);
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching last 60 days:', error);
    return [];
  }
}

// Get top opportunities for a period
async function getTopOpportunities(
  period: '24h' | '7d' | '60d' = '24h',
  exchangeName?: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const viewName = `arbitrage_last_${period}`;
    let query = `
      SELECT 
        exchange_name,
        symbol,
        MAX(percent_difference) as max_difference,
        COUNT(*) as occurrence_count,
        MAX(record_time) as last_seen
      FROM ${viewName}
    `;
    const params: any[] = [];

    if (exchangeName) {
      query += ` WHERE exchange_name = $1`;
      params.push(exchangeName);
    }

    query += ` GROUP BY exchange_name, symbol
      ORDER BY max_difference DESC
      LIMIT $${params.length + 1}`;
    
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching top opportunities:', error);
    return [];
  }
}

// Get statistics for a period
async function getStatistics(
  period: '24h' | '7d' | '60d' = '24h',
  exchangeName?: string
): Promise<any> {
  try {
    const viewName = `arbitrage_last_${period}`;
    let query = `
      SELECT 
        exchange_name,
        COUNT(*) as total_records,
        COUNT(DISTINCT symbol) as unique_symbols,
        AVG(percent_difference) as avg_difference,
        MAX(percent_difference) as max_difference,
        MIN(percent_difference) as min_difference,
        SUM(amount_irt) as total_volume_irt
      FROM ${viewName}
    `;
    const params: any[] = [];

    if (exchangeName) {
      query += ` WHERE exchange_name = $1`;
      params.push(exchangeName);
    }

    query += ` GROUP BY exchange_name`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    return [];
  }
}

// Clean old records (auto cleanup)
async function cleanupOldRecords(daysOld: number = 60): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM arbitrage_history 
       WHERE record_time < NOW() - INTERVAL '${daysOld} days'`
    );
    
    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned ${deletedCount} records older than ${daysOld} days`);
    }
    return deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning old records:', error);
    return 0;
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

export {
  pool,
  initializeDatabase,
  insertArbitrageRecord,
  getLast24Hours,
  getLast7Days,
  getLast60Days,
  getTopOpportunities,
  getStatistics,
  cleanupOldRecords,
  closeDatabase
};