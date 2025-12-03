import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface OrderBook {
  price: string;
  quantity: number;
  sum: string;
}

interface DepthData {
  ask: OrderBook[];
  bid: OrderBook[];
}

interface WallexDepthResponse {
  success: boolean;
  message: string;
  result: {
    [key: string]: DepthData;
  };
}

interface PriceData {
  [symbol: string]: {
    [pair: string]: {
      ask: string[];
      bid: string[];
    };
  };
}

const WALLEX_API_URL = 'https://api.wallex.ir/v2/depth/all';
const OUTPUT_FILE = path.join(process.cwd(), 'wallex_prices_tracker.json');
const INTERVAL = 10000; // 10 seconds

async function fetchWallexPrices(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Fetching prices from Wallex API...`);
    
    const response = await axios.get<WallexDepthResponse>(WALLEX_API_URL);

    if (!response.data.success || !response.data.result) {
      console.error('API request was not successful');
      return;
    }

    const priceData: PriceData = {};
    let usdtToTmnRate = 1; // نرخ تبدیل USDT به TMN
    
    // استخراج نرخ USDT/TMN
    const depthData = response.data.result;
    
    // جستجو برای کلید USDTTMN (بدون حساسیت به بزرگ/کوچکی)
    const usdtTmnKey = Object.keys(depthData).find(key => key.toLowerCase() === 'usdttmn');
    if (usdtTmnKey) {
      const usdtTmn = depthData[usdtTmnKey];
      if (usdtTmn.bid && usdtTmn.bid.length > 0) {
        usdtToTmnRate = parseFloat(usdtTmn.bid[0].price);
        console.log(`[${new Date().toISOString()}] USDT/TMN Rate: ${usdtToTmnRate}`);
      }
    }

    // پردازش تمام جفت‌های ارزی
    Object.entries(depthData).forEach(([pair, depth]) => {
      const lowerPair = pair.toLowerCase();
      
      // استخراج symbol پایه (مثلا btc از btcusdt)
      let baseSymbol = '';
      let pairType = '';
      
      if (lowerPair.endsWith('usdt')) {
        baseSymbol = lowerPair.replace('usdt', '').toUpperCase();
        pairType = 'USDT';
      } else if (lowerPair.endsWith('tmn')) {
        baseSymbol = lowerPair.replace('tmn', '').toUpperCase();
        pairType = 'TMN';
      } else {
        return; // رد کردن جفت‌های غیرمعتبر
      }

      // تجمیع داده‌های bid و ask
      const bestBid = depth.bid && depth.bid.length > 0 ? depth.bid[0] : null;
      const bestAsk = depth.ask && depth.ask.length > 0 ? depth.ask[0] : null;

      if (!bestBid || !bestAsk) return;

      // ایجاد ورودی برای symbol اگر وجود ندارد
      if (!priceData[baseSymbol]) {
        priceData[baseSymbol] = {};
      }

      // فرمت‌بندی داده‌های USDT با تبدیل به TMN
      if (pairType === 'USDT') {
        const bidPriceTmn = (parseFloat(bestBid.price) * usdtToTmnRate).toString();
        const askPriceTmn = (parseFloat(bestAsk.price) * usdtToTmnRate).toString();

        priceData[baseSymbol][lowerPair] = {
          bid: [bestBid.price, bidPriceTmn],
          ask: [bestAsk.price, askPriceTmn]
        };
      } else if (pairType === 'TMN') {
        // فرمت‌بندی داده‌های TMN
        priceData[baseSymbol][lowerPair] = {
          bid: [bestBid.price],
          ask: [bestAsk.price]
        };
      }
    });

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(priceData, null, 2), 'utf-8');
    console.log(`[${new Date().toISOString()}] Prices updated successfully. Total symbols: ${Object.keys(priceData).length}`);
    
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
fetchWallexPrices();

// Set up interval for fetching every 10 seconds
setInterval(fetchWallexPrices, INTERVAL);

console.log(`Wallex price tracker started. Fetching prices every ${INTERVAL / 1000} seconds...`);
