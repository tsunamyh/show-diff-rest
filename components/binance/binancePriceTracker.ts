import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getUsdtToTmnRate } from '../exchanges/tracker/wallexPriceTracker';

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

interface BinanceOrderbooks {
  usdt: { [symbol: string]: { bid: string[]; ask: string[] } };
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

async function fetchBinancePrices(): Promise<BinanceOrderbooks | void> {
  try {
    // console.log(`[${new Date().toISOString()}] Fetching prices from Binance API...`);
    
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
    // const tsOutput = `export interface BinanceOrderbooks {\n  usdt: { [symbol: string]: { bid: string[]; ask: string[] } };\n}\n\nconst binanceOrderbooks: BinanceOrderbooks = ${JSON.stringify(binanceOrderbooks, null, 2)};\n\nexport default binanceOrderbooks;\n`;
    // require('fs').writeFileSync(require('path').join(process.cwd(), './fswritefiles/binance_prices.ts'), tsOutput, 'utf-8');
    // console.log(`[${new Date().toISOString()}] binance_prices.ts updated.`);
    
    return binanceOrderbooks
    
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
export {
fetchBinancePrices
};

// Set up interval for fetching every 10 seconds
// setInterval(fetchBinancePrices, INTERVAL);

