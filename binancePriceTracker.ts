import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface BinancePrice {
  symbol: string;
  price: string;
}

interface BinanceBookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

interface PriceData {
  binance: {
    [symbol: string]: {
      ask: string[];
      bid: string[];
    };
  };
}

interface WallexData {
  wallex: {
    tmn: {
      [symbol: string]: string[];
    };
    usdt: {
      [symbol: string]: string[];
    };
  };
}

const BINANCE_API_URL = 'https://data-api.binance.vision/api/v3/ticker/bookTicker';
const BINANCE_OUTPUT_FILE = path.join(process.cwd(), 'binance_prices.json');
const WALLEX_OUTPUT_FILE = path.join(process.cwd(), 'wallex_prices_tracker.json');
const INTERVAL = 10000; // 10 seconds

function getUsdtToTmnRate(): number {
  try {
    if (fs.existsSync(WALLEX_OUTPUT_FILE)) {
      const wallexData: WallexData = JSON.parse(fs.readFileSync(WALLEX_OUTPUT_FILE, 'utf-8'));
      const usdtTmnPrice = wallexData.wallex?.tmn?.USDT?.[0];
      
      if (usdtTmnPrice) {
        return parseFloat(usdtTmnPrice);
      }
    }
  } catch (error) {
    console.error('Error reading Wallex data:', error);
  }
  
  return 119000; // Default rate if file doesn't exist
}

async function fetchBinancePrices(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Fetching prices from Binance API...`);
    
    const response = await axios.get<BinanceBookTicker[]>(BINANCE_API_URL);
    
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from Binance API');
      return;
    }

    const usdtToTmnRate = getUsdtToTmnRate();
    const binanceOrderbooks = { usdt: {} };
    
    // فیلتر: فقط نمادهایی که با USDT تمام می‌شوند
    response.data
      .filter((item) => item.symbol.endsWith('USDT'))
      .forEach((item) => {
        const baseSymbol = item.symbol.replace('USDT', '');
        const bidPrice = parseFloat(item.bidPrice);
        const askPrice = parseFloat(item.askPrice);
        if (bidPrice === 0 || askPrice === 0) return;
        const bidTmnPrice = (bidPrice * usdtToTmnRate).toString();
        const askTmnPrice = (askPrice * usdtToTmnRate).toString();
        binanceOrderbooks.usdt[item.symbol] = {
          bid: [item.bidPrice, bidTmnPrice],
          ask: [item.askPrice, askTmnPrice]
        };
      });
    // خروجی TypeScript بسازیم
    const tsOutput = `interface BinanceOrderbooks {\n  usdt: { [symbol: string]: { bid: string[]; ask: string[] } };\n}\n\nconst binanceOrderbooks: BinanceOrderbooks = ${JSON.stringify(binanceOrderbooks, null, 2)};\n\nexport default binanceOrderbooks;\n`;
    require('fs').writeFileSync(require('path').join(process.cwd(), 'binance_prices.ts'), tsOutput, 'utf-8');
    console.log(`[${new Date().toISOString()}] binance_prices.ts updated.`);
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] API Error:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
      }
    } else {
      console.error(`[${new Date().toISOString()}] Error:`, error);
    }
  }
}

// Initial fetch
fetchBinancePrices();

// Set up interval for fetching every 10 seconds
setInterval(fetchBinancePrices, INTERVAL);

console.log(`Binance price tracker started. Fetching prices every ${INTERVAL / 1000} seconds...`);
