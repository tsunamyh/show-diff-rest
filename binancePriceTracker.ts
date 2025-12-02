import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface BinancePrice {
  symbol: string;
  price: string;
}

interface PriceData {
  binance: {
    [symbol: string]: string[];
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

const BINANCE_API_URL = 'https://data-api.binance.vision/api/v3/ticker/price';
const BINANCE_OUTPUT_FILE = path.join(__dirname, 'binance_prices.json');
const WALLEX_OUTPUT_FILE = path.join(__dirname, 'wallex_prices_tracker.json');
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
    
    const response = await axios.get<BinancePrice[]>(BINANCE_API_URL);
    
    if (!Array.isArray(response.data)) {
      console.error('Invalid response format from Binance API');
      return;
    }

    const usdtToTmnRate = getUsdtToTmnRate();
    const priceData: PriceData = { binance: {} };
    
    // فیلتر: فقط نمادهایی که با USDT تمام می‌شوند
    response.data
      .filter((item) => item.symbol.endsWith('USDT'))
      .forEach((item) => {
        const baseSymbol = item.symbol.replace('USDT', '');
        const usdtPrice = item.price;
        
        // تبدیل قیمت USDT به تومان
        const tmnPrice = (parseFloat(usdtPrice) * usdtToTmnRate).toString();
        
        priceData.binance[baseSymbol] = [usdtPrice, tmnPrice];
      });

    // Save Binance prices to file
    fs.writeFileSync(BINANCE_OUTPUT_FILE, JSON.stringify(priceData, null, 2), 'utf-8');
    console.log(`[${new Date().toISOString()}] Binance prices updated successfully. Total symbols: ${Object.keys(priceData.binance).length}`);
    
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
