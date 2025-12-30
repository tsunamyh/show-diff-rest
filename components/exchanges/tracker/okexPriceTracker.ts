import axios from 'axios';
import fs from 'fs';
import path from 'path';
import binance_okex_common_symbols from '../../../commonSymbols/okex_binance_common_symbols';

interface OkExOrderbooks {
  exchangeName: string;
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

const OKEX_API_URL = 'https://sapi.ok-ex.io/api/v1/spot/public/books';

const axiosInstance = axios.create({
    method: 'get',
    baseURL: OKEX_API_URL,
    params: {
        limit: 5
    },
    timeout: 5000,
    // maxRedirects: 0
});

// تابع جداگانه برای دریافت نرخ USDT-IRT
async function getUsdtToIrtRate(): Promise<number> {
  try {
    const response = await axiosInstance<any>({
      params: { 
        symbol: 'USDT-IRT'
      }
    });

    if (response.data && response.data.bids && response.data.bids.length > 0) {
      return parseFloat(response.data.bids[0][0]);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('USDT-IRT fetch error Okex:', error.message, error.response?.status, error.response?.data);
    } else {
      console.error('USDT-IRT fetch error Okex:', error);
    }
  }
  
  return 1;
}

// تابع جداگانه برای مرتب‌سازی و پردازش orderBook
function sortOrderBook(
  bidPrice: number,
  bidQty: number,
  askPrice: number,
  askQty: number,
  usdtToTmnRate: number
): { bid: string[]; ask: string[] } {
  const bidPriceTmn = (bidPrice * usdtToTmnRate).toString();
  const askPriceTmn = (askPrice * usdtToTmnRate).toString();
  
  return {
    bid: [bidPriceTmn, bidQty.toString(), bidPrice.toString()],
    ask: [askPriceTmn, askQty.toString(), askPrice.toString()]
  };
}

// تابع برای دریافت orderbook یک سمبل
async function getOkexOrderBookForSymbol(symbol: string) {
  try {
    const response = await axiosInstance<any>({
      params: { 
        symbol: symbol
      }
    });

    if (!response.data || !response.data.bids || !response.data.asks) {
      return null;
    }

    if (response.data.bids.length === 0 || response.data.asks.length === 0) {
      return null;
    }

    const bestBid = response.data.bids[0];
    const bestAsk = response.data.asks[0];

    if (!bestBid || !bestAsk) {
      return null;
    }

    const bidPrice = parseFloat(bestBid[0]);
    const bidQty = bestBid[1];
    const askPrice = parseFloat(bestAsk[0]);
    const askQty = bestAsk[1];

    return {
      symbol: symbol.toLowerCase(),
      bidPrice,
      bidQty,
      askPrice,
      askQty
    };
  } catch (error) {
    // خاموش کردن خطاهای جداگانه سمبل‌ها
    return null;
  }
}

// تابع اصلی برای دریافت تمام orderbooks
async function fetchOkexPrices(): Promise<OkExOrderbooks | undefined> {
  try {
    // console.log(`[${new Date().toISOString()}] Fetching prices from ok-ex.io API...`);
    
    const okexSymbols = binance_okex_common_symbols.symbols.okex_symbol;
    
    // دریافت نرخ تبدیل
    const usdtToTmnRate = await getUsdtToIrtRate();
    
    const okExOrderbooks: OkExOrderbooks = {
      exchangeName: "okex",
      usdtPairs: {}
    };

    // درخواست‌های موازی برای تمام سمبل‌ها (بدون batching)
    const requests = okexSymbols.map(symbol => getOkexOrderBookForSymbol(symbol));
    const results = await Promise.allSettled(requests);

    // پردازش تنها نتایج موفق
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const orderBook = result.value;
        okExOrderbooks.usdtPairs[orderBook.symbol] = sortOrderBook(
          orderBook.bidPrice,
          orderBook.bidQty,
          orderBook.askPrice,
          orderBook.askQty,
          usdtToTmnRate
        );
      }
    });

    // /* Batching mode - uncomment if needed for rate limiting
    // const BATCH_SIZE = 20;
    // for (let i = 0; i < okexSymbols.length; i += BATCH_SIZE) {
    //   const batch = okexSymbols.slice(i, i + BATCH_SIZE);
    //   const requests = batch.map(symbol => getOkexOrderBookForSymbol(symbol));
    //   const results = await Promise.allSettled(requests);
    //   results.forEach((result) => {
    //     if (result.status === 'fulfilled' && result.value) {
    //       const orderBook = result.value;
    //       okExOrderbooks.usdtPairs[orderBook.symbol] = sortOrderBook(
    //         orderBook.bidPrice,
    //         orderBook.bidQty,
    //         orderBook.askPrice,
    //         orderBook.askQty,
    //         usdtToTmnRate
    //       );
    //     }
    //   });
    //   if (i + BATCH_SIZE < okexSymbols.length) {
    //     await new Promise(resolve => setTimeout(resolve, 100));
    //   }
    // }
    // */

    // خروجی TypeScript بسازیم و بنویسیم
    const tsOutput = `export interface OkExOrderbooks {
  exchangeName: string;
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

const okexOrderbooks: OkExOrderbooks = ${JSON.stringify(okExOrderbooks, null, 2)};

export default okexOrderbooks;
`;
    
    const filePath = path.join(process.cwd(), './fswritefiles/okex_prices.ts');
    fs.writeFileSync(filePath, tsOutput, 'utf-8');
    // console.log(`[${new Date().toISOString()}] okex_prices.ts updated.`);

    return okExOrderbooks;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] ok-ex.io API Error:`, error.message);
      if (error.response) {
        console.error('Response status Okex:', error.response.status);
      }
    } else {
      console.error(`[${new Date().toISOString()}] ok-ex.io Error:`, error);
    }
    return undefined;
  }
}

export {
  fetchOkexPrices
};
