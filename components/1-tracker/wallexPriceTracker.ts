import axios from 'axios';

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

interface WallexOrderbooks {
  exchangeName: string;
  tmnPairs: { [pair: string]: { bid: string[]; ask: string[] } };
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

const WALLEX_API_URL = 'https://api.wallex.ir/v2/depth/all';
let wallexGlobalUsdtToTmnRate = 1;

async function fetchWallexUsdtToTmn(){
  try {
    const response = await axios.get("https://api.wallex.ir/v1/depth",{
      params:{symbol : "USDTTMN"},
    })
    wallexGlobalUsdtToTmnRate = parseFloat(response.data.result?.bid?.[0]?.price || "1");
    return wallexGlobalUsdtToTmnRate;
  } catch (error) {
    console.error('Error fetching USDT/TMN rate:', error);
  }
}
fetchWallexUsdtToTmn().then((rate) => {
  console.log(`[${new Date().toISOString()}] Initial USDT/TMN Rate: ${rate}`);
  
});
async function fetchWallexPrices(): Promise<WallexOrderbooks | undefined> {
  try {
    // console.log(`[${new Date().toISOString()}] Fetching prices from Wallex API...`);
    
    const response = await axios.get<WallexDepthResponse>(WALLEX_API_URL);

    if (!response.data.success || !response.data.result) {
      console.error('API request was not successful');
      return undefined;
    }

    const depthData = response.data.result;
    let usdtToTmnRate = 1;
    
    // جستجو برای کلید USDTTMN (بدون حساسیت به بزرگ/کوچکی)
    const usdtTmnKey = Object.keys(depthData).find(key => key.toLowerCase() === 'usdttmn');
    if (usdtTmnKey) {
      const usdtTmn = depthData[usdtTmnKey];
      if (usdtTmn.bid && usdtTmn.bid.length > 0) {
        usdtToTmnRate = parseFloat(usdtTmn.bid[0].price);
        wallexGlobalUsdtToTmnRate = usdtToTmnRate;
        // console.log(`[${new Date().toISOString()}] USDT/TMN Rate: ${usdtToTmnRate}`);
      }
    }

    const wallexOrderbooks : WallexOrderbooks = {
      exchangeName: "wallex",
      tmnPairs: {},
      usdtPairs: {}
    };

    // پردازش تمام جفت‌های ارزی
    Object.entries(depthData).forEach(([pair, depth]) => {
      const lowerPair = pair.toLowerCase();
      
      // استخراج symbol پایه (مثلا btc از btcusdt)
      let pairType = '';
      
      if (lowerPair.endsWith('usdt')) {
        pairType = 'USDT';
      } else if (lowerPair.endsWith('tmn')) {
        pairType = 'TMN';
      } else {
        return; // رد کردن جفت‌های غیرمعتبر
      }

      // تجمیع داده‌های bid و ask
      const bestBid = depth.bid && depth.bid.length > 0 ? depth.bid[0] : null;
      const bestAsk = depth.ask && depth.ask.length > 0 ? depth.ask[0] : null;

      if (!bestBid || !bestAsk) return;
      if (pairType === 'USDT') {
        const bidPriceTmn = (parseFloat(bestBid.price) * usdtToTmnRate).toString();
        const askPriceTmn = (parseFloat(bestAsk.price) * usdtToTmnRate).toString();
        wallexOrderbooks.usdtPairs[lowerPair] = {
          bid: [bidPriceTmn, bestBid.quantity.toString(), bestBid.price, bestBid.sum],
          ask: [askPriceTmn, bestAsk.quantity.toString(), bestAsk.price, bestAsk.sum]
        };
      } else if (pairType === 'TMN') {
        wallexOrderbooks.tmnPairs[lowerPair] = {
          bid: [bestBid.price, bestBid.quantity.toString(), bestBid.sum],
          ask: [bestAsk.price, bestAsk.quantity.toString(), bestAsk.sum]
        };
      }
    });

    // خروجی TypeScript بسازیم
    // const tsOutput = `export interface WallexOrderbooks {\n  exchangeName : string;\n  tmnPairs: { [pair: string]: { bid: string[]; ask: string[] } };\n  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };\n}\n\nconst wallexOrderbooks: WallexOrderbooks = ${JSON.stringify(wallexOrderbooks, null, 2)};\n\nexport default wallexOrderbooks;\n`;
    // require('fs').writeFileSync(require('path').join(process.cwd(), './fswritefiles/wallex_prices.ts'), tsOutput ,'utf-8');
    // console.log(`[${new Date().toISOString()}] wallex_prices.ts updated.`);

    return wallexOrderbooks;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] API Error Wallex:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
      }
    } else {
      console.error(`[${new Date().toISOString()}] Error:`, error);
    }
    return undefined;
  }
}

function getUsdtToTmnRate(): number {
  return wallexGlobalUsdtToTmnRate;
}

// Initial fetch
export {
  fetchWallexPrices,
  fetchWallexUsdtToTmn,
  getUsdtToTmnRate
};

// Set up interval for fetching every 10 seconds
// setInterval(fetchWallexPrices, INTERVAL);