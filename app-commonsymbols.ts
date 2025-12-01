import axios from "axios";
import fs from "fs";

interface BinanceSymbol {
  symbol: string;
  price: string;
}

interface WallexMarket {
  symbol: string;
}

interface WallexResponse {
  result: {
    markets: WallexMarket[];
  };
}

async function getCommonSymbolss(): Promise<void> {
  try {
    console.log("در حال دریافت داده‌ها از Binance...");
    const binanceResponse = await axios.get(
      "https://data-api.binance.vision/api/v3/ticker/price"
    );

    // فیلتر: فقط USDT
    const binanceUSDT = binanceResponse.data
      .filter((item: any) => item.symbol.endsWith("USDT"))
      .map((item: any) => item.symbol);

    console.log(`✓ ${binanceUSDT.length} سمبل USDT از Binance دریافت شد`);

    console.log("در حال دریافت داده‌ها از Wallex...");
    const wallexResponse = await axios.get(
      "https://api.wallex.ir/hector/web/v1/markets"
    );

    const wallexMarkets = wallexResponse.data.result.markets;

    // فیلتر: فقط TMN یا USDT
    const wallexTMNorUSDT = wallexMarkets
      .filter(
        (market: any) =>{
          const cond = (market.symbol.endsWith("TMN") || market.symbol.endsWith("USDT")) && market.is_spot === true
          if ((market.symbol.endsWith("TMN") || market.symbol.endsWith("USDT")) && market.is_spot === false) {
            console.warn(`نماد ${market.symbol} در والکس اسپات نیست و نادیده گرفته شد.`);
          }
          return cond;
        }
      )
      .map((market: any) => market.symbol);

    console.log(
      `✓ ${wallexTMNorUSDT.length} سمبل TMN/USDT از Wallex دریافت شد`
    );

    // استخراج Base Asset (مثلا از BTCUSDT -> BTC، از BTCTMN -> BTC)
    const getBtcSymbols = (symbols: string[]): Set<string> => {
      const bases = new Set<string>();

      symbols.forEach((symbol) => {
        if (symbol.endsWith("USDT")) {
          bases.add(symbol.replace("USDT", ""));
        } else if (symbol.endsWith("TMN")) {
          bases.add(symbol.replace("TMN", ""));
        }
      });

      return bases;
    };

    const binanceBases = getBtcSymbols(binanceUSDT);
    const wallexBases = getBtcSymbols(wallexTMNorUSDT);

    // یافتن Base Assets مشترک
    const commonBases = Array.from(binanceBases).filter((base) =>
      wallexBases.has(base)
    );

    console.log(`✓ ${commonBases.length} Base Asset مشترک پیدا شد`);

    // ساخت نتیجه
    const binanceSymbols: string[] = [];
    const wallexSymbols: string[][] = [];

    commonBases.forEach((base) => {
      // پیدا کردن سمبل Binance
      const binSymbol = binanceUSDT.find((sym:any) => sym === `${base}USDT`);
      if (binSymbol) {
        binanceSymbols.push(binSymbol);
      }

      // پیدا کردن سمبل‌های Wallex (TMN و USDT)
      const wallexSymbolsTMN = wallexTMNorUSDT.find(
        (sym: string) => sym === `${base}TMN`
      );
      const wallexSymbolsUSDT = wallexTMNorUSDT.find(
        (sym: string) => sym === `${base}USDT`
      );

      const pair: string[] = [];
      if (wallexSymbolsTMN) pair.push(wallexSymbolsTMN);
      if (wallexSymbolsUSDT) pair.push(wallexSymbolsUSDT);

      if (pair.length > 0) {
        wallexSymbols.push(pair);
      }
    });

    const resultObj = {
      count: commonBases.length,
      timestamp: new Date().toISOString(),
      symbols: {
        binance_symbol: binanceSymbols,
        wallex_symbol: wallexSymbols,
      },
    };

    // const result = "interface Coin {\ncount: number;\ntimestamp: string;\nsymbols: {\nbinance_symbol: string[];\nwallex_symbol: [string, string][];\n};\n} \n\n"+ "const  binance_wallex_common_symbols: Coin =" + JSON.stringify(resultObj, null, 2) + "\n\nexport default binance_wallex_common_symbols;";
    const result = `interface Coin {
  count: number;
  timestamp: string;
  symbols: {
    binance_symbol: string[];
    wallex_symbol: [string, string][];
  };
} \n\nconst  binance_wallex_common_symbols: Coin = ${JSON.stringify(
      resultObj,
      null,
      2
    )} \n\nexport default binance_wallex_common_symbols;`;
    console.log(`\n✓ ${commonBases.length} ارز مشترک پیدا شد`);

    // ذخیره در JSON
    fs.writeFileSync(
      "common_symbols.ts",
      result,
      "utf-8"
    );
    console.log("✓ فایل common_symbols.ts ذخیره شد");
  } catch (error) {
    console.error("خطا:", error instanceof Error ? error.message : error);
  }
}

getCommonSymbolss();
