import axios from 'axios';

interface OrderBook {
  price: string;
  quantity: number;
  sum: string;
}

enum DepthDataIndex {
  PRICE = 0,
  QUANTITY = 1,
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
  tmnPairs: { [pair: string]: { bid: string[]; ask: string[] } };
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
        usdtToIrtRate = parseFloat(usdtIrt.bids[0][DepthDataIndex.PRICE]) / 10;
        globalUsdtToIrtRate = Math.floor(usdtToIrtRate); 
        console.log(`[${new Date().toISOString()}] USDT/IRT Rate: ${globalUsdtToIrtRate}`);
      }
    }

    const nobitexOrderbooks : NobitexOrderbooks = {
      exchangeName: "Nobitex",
      tmnPairs: {},
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
        const bidPriceIrt = (parseFloat(bestBid[DepthDataIndex.PRICE]) * globalUsdtToIrtRate).toString();
        const askPriceIrt = (parseFloat(bestAsk[DepthDataIndex.PRICE]) * globalUsdtToIrtRate).toString();
        nobitexOrderbooks.usdtPairs[lowerPair] = {
          bid: [bidPriceIrt, bestBid[DepthDataIndex.QUANTITY], bestBid[DepthDataIndex.PRICE]],
          ask: [askPriceIrt, bestAsk[DepthDataIndex.QUANTITY], bestAsk[DepthDataIndex.PRICE]]
        };
      } else if (pairType === 'IRT') {
        const bestBidToTmn = (parseFloat(bestBid[DepthDataIndex.PRICE]) / 10).toString();
        const bestAskToTmn = (parseFloat(bestAsk[DepthDataIndex.PRICE]) / 10).toString();
        const bidAmountIrt = +bestBidToTmn * +bestBid[DepthDataIndex.QUANTITY];
        const askAmountIrt = +bestAskToTmn * +bestAsk[DepthDataIndex.QUANTITY];
        nobitexOrderbooks.tmnPairs[lowerPair] = {
          bid: [
            bestBidToTmn, 
            bestBid[DepthDataIndex.QUANTITY], 
            bidAmountIrt.toString(),
          ],
          ask: [
            bestAskToTmn,
            bestAsk[DepthDataIndex.QUANTITY], 
            askAmountIrt.toString(),
          ]
        };
      }
    });

    console.log(`[${new Date().toISOString()}] IRT Pairs Count: ${Object.keys(nobitexOrderbooks.tmnPairs).length}`);
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
