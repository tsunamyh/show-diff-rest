import 'dotenv/config';
import { server } from "../server";
import { intervalFunc } from '../components/3-comparisons/3-compare/comprasion';
import { ensureDatabase, initializeDatabase, getDbStatus } from '../components/utils/dbManager';

const port: number = Number(process.env.PORT) || 3000;

// Retry logic for database connection
async function initializeDatabaseWithRetry(maxRetries: number = 3, delayMs: number = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📊 Database initialization attempt ${attempt}/${maxRetries}...`);
      await ensureDatabase();
      await initializeDatabase();
      console.log('✅ Database initialized successfully');
      return true;
    } catch (error: any) {
      const errorMsg = error.message || error.code || 'Unknown error';
      
      // If it's a connection error (server not available), don't retry - just fail
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        console.error(`❌ Cannot connect to PostgreSQL server (attempt ${attempt}/${maxRetries})`);
        console.error(`   Error: ${errorMsg}`);
        // Don't retry for connection refusal - database is not available
        return false;
      }
      
      console.error(`❌ Attempt ${attempt} failed:`, errorMsg);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  console.warn('⚠️  Database initialization failed after all retries');
  return false;
}

async function start() {
  let dbInitialized = false;

  try {
    // Try to initialize database with retries
    console.log('🔄 Starting database initialization...');
    dbInitialized = await initializeDatabaseWithRetry(3, 20000);
    
    if (!dbInitialized) {
      const status = getDbStatus();
      if (status.available) {
        console.warn('⚠️  Database initialization incomplete. Starting server in degraded mode.');
      } else {
        console.warn('⚠️  PostgreSQL server not available. Starting server in DEGRADED MODE (no database).');
      }
    }
  } catch (error: any) {
    console.error('❌ Unexpected error during database initialization:', error.message);
  }

  // Start server regardless of database status
  server.listen(port, () => {
    const status = getDbStatus();
    console.log(`🚀 Server is listening on port ${port}`);
    console.log(`📊 Database status: ${status.mode.toUpperCase()}`);
    if (!dbInitialized) {
      console.warn('⚠️  All features work except data persistence');
    }
  });

  // Start price comparison logic
  try {
    intervalFunc();
  } catch (error: any) {
    console.log("⚠️  Price comparison not started yet:", error.message);
  }
}

start()