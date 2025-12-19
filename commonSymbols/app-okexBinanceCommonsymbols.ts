import axios from "axios";
import fs from "fs";

interface BinanceSymbol {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

interface OkexPair {
  symbol: string;
  base: string;
  quote: string;
  minNotional: number;
  maxNotional: number;
  quantityTick: number;
  priceTick: number;
  isTrade: boolean;
  isCancelOrder: boolean;
  orderTypes: string;
  sort: number;
}

async function getCommonSymbols(): Promise<void> {
  try {
    console.log("در حال دریافت داده‌ها از Binance...");
    const binanceResponse: { data: BinanceSymbol[] } = await axios.get(
      "https://data-api.binance.vision/api/v3/ticker/bookTicker"
    );

    // فیلتر: فقط USDT
    const binanceUSDT = binanceResponse.data
      .filter(
        (item) =>
          item.symbol.endsWith("USDT") &&
          +item.bidPrice !== 0 &&
          +item.askPrice !== 0
      )
      .map((item: any) => item.symbol);

    console.log(`✓ ${binanceUSDT.length} سمبل USDT از Binance دریافت شد`);

    console.log("در حال دریافت داده‌ها از Okex...");
    const okexResponse = await axios.get(
      "https://sapi.ok-ex.io/api/v1/spot/public/pairs"
    );

    const okexPairs = okexResponse.data;
    // console.log(okexPairs);
    
    // فیلتر: فقط IRT (پول ایران) و تریدپذیر
    const okexIRT = okexPairs
      .filter((pair: OkexPair) => {
        const cond = pair.quote === "USDT" && pair.isTrade === true;
        if (pair.quote === "IRT" && pair.isTrade === false) {
          console.warn(
            `نماد ${pair.symbol} در Okex تریدپذیر نیست و نادیده گرفته شد.`
          );
        }
        return cond;
      })
      .map((pair: OkexPair) => pair.symbol);

    console.log(`✓ ${okexIRT.length} سمبل USDT از Okex دریافت شد`);

    // استخراج Base Asset (مثلا از BTCUSDT -> BTC، از BTC-IRT -> BTC)
    const getBaseSymbols = (symbols: string[]): Set<string> => {
      const bases = new Set<string>();

      symbols.forEach((symbol) => {
        if (symbol.endsWith("USDT")) {
          bases.add(symbol.replace("USDT", ""));
        }
      });

      return bases;
    };

    const getBases = (symbols: string[]): Set<string> => {
      const bases = new Set<string>();

      symbols.forEach((symbol) => {
        // Okex format: BTC-IRT
        if (symbol.includes("-")) {
          const base = symbol.split("-")[0];
          bases.add(base);
        }
      });

      return bases;
    };

    const binanceBases = getBaseSymbols(binanceUSDT);
    const okexBases = getBases(okexIRT);

    // یافتن Base Assets مشترک
    const commonBases = Array.from(binanceBases).filter((base) =>
      okexBases.has(base)
    );

    console.log(`✓ ${commonBases.length} Base Asset مشترک پیدا شد`);

    // ساخت نتیجه
    const binanceSymbols: string[] = [];
    const okexSymbols: string[] = [];

    commonBases.forEach((base) => {
      // پیدا کردن سمبل Binance
      const binSymbol = binanceUSDT.find((sym: any) => sym === `${base}USDT`);
      if (binSymbol) {
        binanceSymbols.push(binSymbol);
      }

      // پیدا کردن سمبل Okex (base-IRT)
      const okexSymbol = okexIRT.find(
        (sym: string) => sym === `${base}-USDT`
      );
      if (okexSymbol) {
        okexSymbols.push(okexSymbol);
      }
    });

    const resultObj = {
      count: commonBases.length,
      timestamp: new Date().toISOString(),
      symbols: {
        binance_symbol: binanceSymbols,
        okex_symbol: okexSymbols,
      },
    };

    const result = `interface Coin {
  count: number;
  timestamp: string;
  symbols: {
    binance_symbol: string[];
    okex_symbol: string[];
  };
} \n\nconst binance_okex_common_symbols: Coin = ${JSON.stringify(
      resultObj,
      null,
      2
    )} \n\nexport default binance_okex_common_symbols;`;

    console.log(`\n✓ ${commonBases.length} ارز مشترک پیدا شد`);

    // ذخیره در فایل TypeScript
    fs.writeFileSync(
      "./commonSymbols/okex_binance_common_symbols.ts",
      result,
      "utf-8"
    );
    console.log("✓ فایل okex_binance_common_symbols.ts ذخیره شد");
  } catch (error) {
    console.error("خطا:", error instanceof Error ? error.message : error);
  }
}

getCommonSymbols();
