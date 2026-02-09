import 'dotenv/config';
import { server } from "../server";
import { intervalFunc } from '../components/3-comparisons/3-compare/comprasion';
import { ensureDatabase, initializeDatabase } from '../components/utils/dbManager';

const port: number = Number(process.env.PORT) || 3000;

async function start() {
  try {
    // Initialize database first
    console.log('🔄 Starting database initialization...');
    await ensureDatabase();
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    server.listen(port, () => {
      console.log(`🚀 Server is listening on port ${port}`)
    });
    try {
        intervalFunc()
      } catch (error: any) {
      console.log("hanooz shoroo nashode:", error.message);
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }

}

start()