import axios from 'axios';
import { getUsdtToTmnRate } from './wallexPriceTracker';
import binance_okex_common_symbols from '../../commonSymbols/okex_binance_common_symbols';

interface OkExOrderbooks {
  exchangeName: string;
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

// ok-ex.io API endpoints
const OKEX_DEPTH_API_URL = 'https://sapi.ok-ex.io/api/v1/spot/public/depth';

async function fetchOkexPrices(): Promise<OkExOrderbooks | void> {
  try {
    // console.log(`[${new Date().toISOString()}] Fetching prices from ok-ex.io API...`);
    
    const usdtToTmnRate = getUsdtToTmnRate();
    
    const okExOrderbooks: OkExOrderbooks = {
      exchangeName: "ok-ex",
      usdtPairs: {}
    };

    // Get Okex symbols from common symbols
    const okexSymbols = binance_okex_common_symbols.symbols.okex_symbol;

    // فرستادن درخواست برای هر سمبل به صورت جداگانه
    for (const symbol of okexSymbols) {
      try {
        const response = await axios.get<any>(OKEX_DEPTH_API_URL, {
          params: {
            symbol: symbol,  // مثلا: USDT-IRT یا BTC-USDT
            limit: 1  // فقط بهترین bid و ask
          },
          timeout: 5000
        });

        if (!response.data || !response.data.data) {
          console.warn(`ok-ex.io API warning for ${symbol}: No data returned`);
          continue;
        }

        const depthData = response.data.data;
        
        // استخراج بهترین bid و ask از depth data
        const bestBid = depthData.bids && depthData.bids.length > 0 ? depthData.bids[0] : null;
        const bestAsk = depthData.asks && depthData.asks.length > 0 ? depthData.asks[0] : null;

        if (!bestBid || !bestAsk) {
          console.warn(`ok-ex.io warning: No valid bid or ask data for ${symbol}`);
          continue;
        }

        const bidPrice = parseFloat(bestBid[0]);
        const bidQty = parseFloat(bestBid[1]);
        const askPrice = parseFloat(bestAsk[0]);
        const askQty = parseFloat(bestAsk[1]);

        if (bidPrice === 0 || askPrice === 0) {
          console.warn(`ok-ex.io warning: Zero price for ${symbol}`);
          continue;
        }

        // تبدیل قیمت USDT به TMN
        const bidPriceTmn = (bidPrice * usdtToTmnRate).toString();
        const askPriceTmn = (askPrice * usdtToTmnRate).toString();

        // ذخیره با کلید lowercase برای سازگاری
        const symbolKey = symbol.toLowerCase();

        okExOrderbooks.usdtPairs[symbolKey] = {
          bid: [bidPrice.toString(), bidQty.toString(), bidPriceTmn],
          ask: [askPrice.toString(), askQty.toString(), askPriceTmn]
        };

      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.warn(`[${new Date().toISOString()}] ok-ex.io API Error for ${symbol}:`, error.message);
        } else {
          console.warn(`[${new Date().toISOString()}] ok-ex.io Error for ${symbol}:`, error);
        }
        // ادامه برای سمبل بعدی
        continue;
      }
    }

    // console.log(`[${new Date().toISOString()}] ok-ex.io prices fetched: ${Object.keys(okExOrderbooks.usdtPairs).length} pairs`);
    
    return okExOrderbooks;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] ok-ex.io API Error:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
      }
    } else {
      console.error(`[${new Date().toISOString()}] ok-ex.io Error:`, error);
    }
  }
}

export {
  fetchOkexPrices
};
