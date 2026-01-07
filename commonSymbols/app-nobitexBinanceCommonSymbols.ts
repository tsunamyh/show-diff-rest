import axios from "axios";
import fs from "fs";

const nobBaseUrl = "https://apiv2.nobitex.ir/v3/orderbook/all";
const BinanceUrl = "https://data-api.binance.vision/api/v3/ticker/bookTicker";
interface BinanceResponse {
  data: {
    symbol: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
  }[]
}

interface NobitexResponse {
  data: {
    status: "ok";
    [pair: string]: {
      "lastUpdate": number;
      "asks": [
        [string, string],
        [string, string]
      ];
      "bids": [
        [string, string],
        [string, string]
      ];
    } | "ok";
  };
}

const nobIstance = axios.create({
  baseURL: nobBaseUrl,
});

const binanceInstance = axios.create({
  baseURL: BinanceUrl,
});

async function getCommonSymbolss(): Promise<void> {
  try {
    console.log("در حال دریافت داده‌ها از Binance...");
    const binanceResponse = await axios.get(
      "https://data-api.binance.vision/api/v3/ticker/bookTicker"
    );

    // فیلتر: فقط USDT
    const binanceUSDT = binanceResponse.data
      .filter(
        (item: any) =>
          item.symbol.endsWith("USDT") &&
          +item.bidPrice !== 0 &&
          +item.askPrice !== 0
      )
      .map((item: any) => item.symbol);

    console.log(`✓ ${binanceUSDT.length} سمبل USDT از Binance دریافت شد`);

    console.log("در حال دریافت داده‌ها از Nobitex...");
    const nobitexResponse = await axios.get(nobBaseUrl);

    // استخراج تمام پیرهای Nobitex
    const nobitexPairs: string[] = [];
    const data = nobitexResponse.data;

    for (const key in data) {
      if (key !== "status" && typeof data[key] === "object" && data[key] !== null) {
        nobitexPairs.push(key);
      }
    }

    // فیلتر: USDT و IRT
    const nobitexUSDT = nobitexPairs.filter((pair: string) =>
      pair.endsWith("USDT")
    );
    const nobitexIRT = nobitexPairs.filter((pair: string) =>
      pair.endsWith("IRT")
    );

    console.log(`✓ ${nobitexUSDT.length} سمبل USDT از Nobitex دریافت شد`);
    console.log(`✓ ${nobitexIRT.length} سمبل IRT از Nobitex دریافت شد`);

    // استخراج Base Asset از USDT
    const getBaseSymbols = (symbols: string[]): Set<string> => {
      const bases = new Set<string>();

      symbols.forEach((symbol) => {
        if (symbol.endsWith("USDT")) {
          bases.add(symbol.replace("USDT", ""));
        }
      });

      return bases;
    };

    const binanceBases = getBaseSymbols(binanceUSDT);
    const nobitexBases = getBaseSymbols(nobitexUSDT);

    // یافتن Base Assets مشترک
    const commonBases = Array.from(binanceBases).filter((base) =>
      nobitexBases.has(base)
    );

    console.log(`✓ ${commonBases.length} Base Asset مشترک پیدا شد`);

    // ساخت نتیجه
    const binanceSymbols: string[] = [];
    const nobitexUSDTSymbols: string[] = [];
    const nobitexIRTSymbols: string[] = [];

    commonBases.forEach((base) => {
      // پیدا کردن سمبل Binance
      const binSymbol = binanceUSDT.find((sym: string) => sym === `${base}USDT`);
      if (binSymbol) {
        binanceSymbols.push(binSymbol);
      }

      // پیدا کردن سمبل Nobitex USDT
      const notUSDTSymbol = nobitexUSDT.find((sym: string) => sym === `${base}USDT`);
      if (notUSDTSymbol) {
        nobitexUSDTSymbols.push(notUSDTSymbol);
      }

      // پیدا کردن سمبل Nobitex IRT
      const notIRTSymbol = nobitexIRT.find((sym: string) => sym === `${base}IRT`);
      if (notIRTSymbol) {
        nobitexIRTSymbols.push(notIRTSymbol);
        console.log(notIRTSymbol);
        
      }
    });

    const resultObj = {
      count: commonBases.length,
      timestamp: new Date().toISOString(),
      symbols: {
        binance_symbol: binanceSymbols,
        nobitex_symbol: {
          irtPairs: nobitexIRTSymbols,
          usdtPairs: nobitexUSDTSymbols,
        },
      },
    };

    const result = `interface Coin {
  count: number;
  timestamp: string;
  symbols: {
    binance_symbol: string[];
    nobitex_symbol: {
      irtPairs: string[];
      usdtPairs: string[];
    };
  };
} \n\nconst binance_nobitex_common_symbols: Coin = ${JSON.stringify(
      resultObj,
      null,
      2
    )} \n\nexport default binance_nobitex_common_symbols;`;

    console.log(`\n✓ ${commonBases.length} ارز مشترک پیدا شد`);
    console.log(`  - ${nobitexIRTSymbols.length} سمبل IRT`);
    console.log(`  - ${nobitexUSDTSymbols.length} سمبل USDT`);

    // ذخیره در فایل TypeScript
    fs.writeFileSync(
      "./commonSymbols/nobitex_binance_common_symbols.ts",
      result,
      "utf-8"
    );
    console.log("✓ فایل nobitex_binance_common_symbols.ts ذخیره شد");
  } catch (error) {
    console.error("خطا:", error instanceof Error ? error.message : error);
  }
}

getCommonSymbolss();

