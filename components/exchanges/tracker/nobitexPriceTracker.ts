import axios from 'axios';

interface OrderBook {
  price: string;
  quantity: number;
  sum: string;
}

interface DepthData {
  ask: [string, string][];
  bid: [string, string][];
}

interface NobitexDepthResponse {
  data: {
    status: "ok";
    [pair: string]: {
      "lastUpdate": number;
      "asks": [string, string][];
      "bids": [string, string][];
    } | "ok";
  };
}

interface NobitexOrderbooks {
  exchangeName: "Nobitex";
  irtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

const NOBITEX_API_URL = 'https://apiv2.nobitex.ir/v3/orderbook/all';
let globalUsdtToIrtRate = 1;

async function fetchNobitexPrices(): Promise<NobitexOrderbooks | undefined> {
  try {
    console.log(`[${new Date().toISOString()}] Fetching prices from Nobitex API...`);
    
    const response = await axios.get<NobitexDepthResponse>(NOBITEX_API_URL);

    if (!response.data) {
      console.error('API request was not successful');
      return undefined;
    }

    const depthData = response.data;
    let usdtToIrtRate = 1;
    
    // جستجو برای کلید USDTIRT (بدون حساسیت به بزرگ/کوچکی)
    const usdtIrtKey = Object.keys(depthData).find(key => key.toLowerCase() === 'usdtirt');
    if (usdtIrtKey && typeof depthData[usdtIrtKey] === 'object' && depthData[usdtIrtKey] !== null && 'bids' in depthData[usdtIrtKey]) {
      const usdtIrt = depthData[usdtIrtKey] as any;
      if (usdtIrt.bids && usdtIrt.bids.length > 0) {
        usdtToIrtRate = parseFloat(usdtIrt.bids[0][0]);
        globalUsdtToIrtRate = usdtToIrtRate;
        console.log(`[${new Date().toISOString()}] USDT/IRT Rate: ${usdtToIrtRate}`);
      }
    }

    const nobitexOrderbooks : NobitexOrderbooks = {
      exchangeName: "Nobitex",
      irtPairs: {},
      usdtPairs: {}
    };

    // پردازش تمام جفت‌های ارزی
    Object.entries(depthData).forEach(([pair, data]) => {
      // بررسی اینکه آیا این یک شی depth است یا status
      if (typeof data !== 'object' || !data || !('bids' in data) || !('asks' in data)) {
        return; // رد کردن status یا اشیاء غیرمعتبر
      }

      const lowerPair = pair.toLowerCase();
      let pairType = '';
      
      if (lowerPair.endsWith('usdt')) {
        pairType = 'USDT';
      } else if (lowerPair.endsWith('irt')) {
        pairType = 'IRT';
      } else {
        return; // رد کردن جفت‌های غیرمعتبر
      }

      const depth = data as any;
      
      // تجمیع داده‌های bid و ask
      const bestBid = depth.bids && depth.bids.length > 0 ? depth.bids[0] : null;
      const bestAsk = depth.asks && depth.asks.length > 0 ? depth.asks[0] : null;

      if (!bestBid || !bestAsk) return;

      if (pairType === 'USDT') {
        const bidPriceIrt = (parseFloat(bestBid[0]) * usdtToIrtRate).toString();
        const askPriceIrt = (parseFloat(bestAsk[0]) * usdtToIrtRate).toString();
        nobitexOrderbooks.usdtPairs[lowerPair] = {
          bid: [bidPriceIrt, bestBid[1], bestBid[0]],
          ask: [askPriceIrt, bestAsk[1], bestAsk[0]]
        };
      } else if (pairType === 'IRT') {
        nobitexOrderbooks.irtPairs[lowerPair] = {
          bid: [bestBid[0], bestBid[1]],
          ask: [bestAsk[0], bestAsk[1]]
        };
      }
    });

    console.log(`[${new Date().toISOString()}] IRT Pairs Count: ${Object.keys(nobitexOrderbooks.irtPairs).length}`);
    console.log(`[${new Date().toISOString()}] USDT Pairs Count: ${Object.keys(nobitexOrderbooks.usdtPairs).length}`);

    return nobitexOrderbooks;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] API Error Nobitex:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
      }
    } else {
      console.error(`[${new Date().toISOString()}] Error:`, error);
    }
    return undefined;
  }
}

function getUsdtToIrtRate(): number {
  return globalUsdtToIrtRate;
}

// Initial fetch
export {
  fetchNobitexPrices,
  getUsdtToIrtRate
};

// Set up interval for fetching every 10 seconds
// setInterval(fetchNobitexPrices, INTERVAL);
