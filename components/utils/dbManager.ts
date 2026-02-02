import { Pool, QueryResult } from 'pg';

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

    // Create index for faster queries on last 24 hours
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_timestamp 
      ON arbitrage_opportunities(timestamp DESC);
    `);

    // Create index on symbol for filtering
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_symbol 
      ON arbitrage_opportunities(symbol);
    `);

    // Create index on exchange_name
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_exchange 
      ON arbitrage_opportunities(exchange_name);
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

// Clean old records (older than 24 hours)
async function cleanOldRecords(): Promise<number | null> {
  try {
    const result = await pool.query(
      `DELETE FROM arbitrage_opportunities 
       WHERE timestamp < NOW() - INTERVAL '24 hours';`
    );
    console.log(`🧹 Cleaned ${result.rowCount} old records`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error cleaning old records:', error);
    return null;
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
  getTopOpportunities,
  getStatistics,
  cleanOldRecords,
  closeDatabase
};
