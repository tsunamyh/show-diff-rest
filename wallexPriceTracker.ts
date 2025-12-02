import axios from 'axios';
import fs from 'fs';
import path from 'path';
import binance_wallex_common_symbols from './common_symbols';

interface WallexMarket {
  price: string;
  is_spot: boolean;
  [key: string]: any;
}

interface WallexResponse {
  success: boolean;
  message: string;
  result: {
    markets: WallexMarket[];
  };
}

interface PriceData {
  wallex: {
    tmn: {
      [symbol: string]: string[];
    };
    usdt: {
      [symbol: string]: string[];
    };
  };
}

const WALLEX_API_URL = 'https://api.wallex.ir/hector/web/v1/markets';
const OUTPUT_FILE = path.join(__dirname, 'wallex_prices_tracker.json');
const INTERVAL = 10000; // 10 seconds

// Map of wallex symbols from common_symbols
const wallexSymbolMap = new Map<string, string>();
binance_wallex_common_symbols.symbols.wallex_symbol.forEach(([tmnSymbol, usdtSymbol]) => {
  wallexSymbolMap.set(tmnSymbol, usdtSymbol);
});

async function fetchWallexPrices(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Fetching prices from Wallex API...`);
    
    const response = await axios.get<WallexResponse>(WALLEX_API_URL);
    
    if (!response.data.success) {
      console.error('API request was not successful:', response.data.message);
      return;
    }

    const priceData: PriceData = { wallex: { tmn: {}, usdt: {} } };
    let usdtToTmnRate = 1; // نرخ تبدیل USDT به TMN
    
    // Process markets data - استفاده از symbol یا name
    response.data.result.markets.forEach((market: any) => {
      const symbol = market.symbol || market.name;
      
      if (!symbol) return;

      // بررسی جفت‌های TMN
      const tmnMatch = symbol.match(/^(.+)TMN$/i);
      if (tmnMatch) {
        const baseSymbol = tmnMatch[1].toUpperCase();
        priceData.wallex.tmn[baseSymbol] = [market.price];
        
        // ذخیره نرخ تبدیل USDT/TMN
        if (baseSymbol === 'USDT') {
          usdtToTmnRate = parseFloat(market.price);
        }
        return;
      }

      // بررسی جفت‌های USDT
      const usdtMatch = symbol.match(/^(.+)USDT$/i);
      if (usdtMatch) {
        const baseSymbol = usdtMatch[1].toUpperCase();
        const usdtPrice = market.price;
        
        // تبدیل قیمت USDT به تومان
        const tmnPrice = (parseFloat(usdtPrice) * usdtToTmnRate).toString();
        
        priceData.wallex.usdt[baseSymbol] = [usdtPrice, tmnPrice];
        return;
      }
    });

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(priceData, null, 2), 'utf-8');
    console.log(`[${new Date().toISOString()}] Prices updated successfully. Total symbols: ${Object.keys(priceData.wallex.tmn).length + Object.keys(priceData.wallex.usdt).length}`);
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] API Error:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    } else {
      console.error(`[${new Date().toISOString()}] Error:`, error);
    }
  }
}

// Initial fetch
fetchWallexPrices();

// Set up interval for fetching every 10 seconds
setInterval(fetchWallexPrices, INTERVAL);

console.log(`Wallex price tracker started. Fetching prices every ${INTERVAL / 1000} seconds...`);
