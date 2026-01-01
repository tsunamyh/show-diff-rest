// import type { WallexOrderbooks } from "../wallex_prices";
// import type { BinanceOrderbooks } from "../binance_prices";
// import { EventEmitter } from "stream";
import wallex_binance_common_symbols from "../../../commonSymbols/wallex_binance_common_symbols";
import { getAllexchangesOrderBooks, fetchExchangesOnce } from "../../controller";
import { BinanceOrderbooks } from "../../types/types";
import { OkexOrderbooks, WallexOrderbooks } from "../../types/types";
import { loadHistoryFromFile, saveHistoryToFile } from "../../utils/historyManager";
import { validateAndExecuteTrade } from "../../exchanges/purchasing/tradeValidator";
import { wallexGetBalances } from "../../exchanges/purchasing/parchasing-controller";

// تابع چک موجودی از API والکس و برگرداندن مقدار واقعی
async function getAvailableBalance(symbol: string): Promise<number> {
  try {
    let baseCurrency = '';
    if (symbol.endsWith('TMN')) {
      baseCurrency = symbol.replace('TMN', ''); // e.g., BTCTMN → BTC
    } else if (symbol.endsWith('USDT')) {
      baseCurrency = symbol.replace('USDT', ''); // e.g., BTCUSDT → BTC
    } const availableBalanceStr = await wallexGetBalances(baseCurrency);
    const currentBalance = parseFloat(availableBalanceStr) || 0;
    console.log(`Available balance for ${symbol}: ${currentBalance}`);
    return currentBalance;
  } catch (error) {
    console.error(`Error fetching balance for ${symbol}:`, error);
    return 0;
  }
}

const wallexBinanceCommonSymbols = wallex_binance_common_symbols.symbols;

//  * مثال: [tmnPrice, volumeCurrency, usdtPrice]
enum WallexUsdtPairIndex {
  TMN_PRICE = 0,           // "11504590301.58"
  VOLUME_CURRENCY = 1,     // "0.008676"
  USDT_PRICE = 2           // "91762.17"
}

// * مثال: [tmnPrice, volumeCurrency]
enum WallexTmnPairIndex {
  TMN_PRICE = 0,           // "11511692152"
  VOLUME_CURRENCY = 1      // "0.008717"
}

//* مثال: [usdtPrice, tmnPrice]
enum BinanceIndex {
  USDT_PRICE = 0,          // "91991.32000000"
  TMN_PRICE = 1            // "11533319753.68"
}

interface RowData {
  symbol: string;
  percent: number;
  wallex: [string, string];
  binance: string;
  value: number;
  description: string;
  statusCompare: string;
}

interface RowInfo {
  exchangeName: string;
  statusbuy: string;
  rowData: RowData;
}

const myPercent = process.env.MYPERCENT || 2.2;
const internalPercent = process.env.INTERNALPERCENT || 0.5;

// Global variable to store the latest rows info
let latestRowsInfo: RowInfo[] = [];

// Global variable to track top 5 currencies with biggest differences and their top 5 percentages
interface PercentageRecord {
  time: string;
  value: number;
  exchangeBuyPrice?: number;
  binanceSellPrice?: number;
  buyVolume?: number;
}

interface CurrencyDiffTracker {
  symbol: string;
  statusCompare: string;
  maxDifference: number;
  percentages: PercentageRecord[];
}

let currencyDiffTracker: Map<string, CurrencyDiffTracker> = new Map();
let sortedCurrencies: CurrencyDiffTracker[] = [];

// Initialize tracker with history on startup
function initializeTrackerWithHistory() {
  const historyMap = loadHistoryFromFile('wallex');
  currencyDiffTracker = historyMap;
  sortedCurrencies = Array.from(currencyDiffTracker.values())
    .sort((a, b) => b.maxDifference - a.maxDifference)
    .slice(0, 5);
}

function getLatestRowsInfo() {
  return latestRowsInfo;
}

function getTehranTime(): string {
  const now = new Date();
  const tehranTime = now.toLocaleString("en-US", { timeZone: "Asia/Tehran" });

  return tehranTime;
}

function shouldAddPercentage(lastRecord: PercentageRecord | undefined, newValue: number, minIntervalSeconds: number = 120): boolean {
  if (!lastRecord) return true;

  // اگر value متفاوت است، اضافه کن
  if (lastRecord.value !== newValue) return true;

  // اگر value یکسان است، فاصله زمانی رو بررسی کن
  const lastTime = new Date(lastRecord.time).getTime();
  const currentTime = new Date(getTehranTime()).getTime();
  const timeDifferenceSeconds = (currentTime - lastTime) / 1000;

  // اگر فاصله زمانی بیشتر از حد تعیین شده است، اضافه کن
  return timeDifferenceSeconds >= minIntervalSeconds;
}

function updateCurrencyDiffTracker(rowsInfo: RowInfo[]) {
  // console.log("currencyDiffTracker:", currencyDiffTracker);

  rowsInfo.forEach(row => {
    const { symbol, percent, wallex, binance, value } = row.rowData;
    const currentTime = getTehranTime();
    const percentRecord: PercentageRecord = {
      time: currentTime,
      value: percent,
      exchangeBuyPrice: parseFloat(wallex[0]),
      binanceSellPrice: parseFloat(binance),
      buyVolume: value
    };

    if (!currencyDiffTracker.has(symbol) /* || currencyDiffTracker.get(symbol).statusCompare !== row.rowData.statusCompare */) {
      currencyDiffTracker.set(symbol, {
        symbol,
        statusCompare: row.rowData.statusCompare,
        maxDifference: percent,
        percentages: [percentRecord]
      });
    } else {
      const tracker = currencyDiffTracker.get(symbol)!;
      const lastRecord = tracker.percentages[0]; // آخرین record (ترتیب نزولی هست)

      tracker.maxDifference = Math.max(tracker.maxDifference, percent);

      // فقط اگر condition رو pass کنه، اضافه کن
      if (shouldAddPercentage(lastRecord, percent)) {
        tracker.percentages.push(percentRecord);
        tracker.percentages = tracker.percentages.sort((a, b) => b.value - a.value).slice(0, 5);
      }
    }
  })

  sortedCurrencies = Array.from(currencyDiffTracker.values())
    .sort((a, b) => b.maxDifference - a.maxDifference)

  // Save to file after update
  saveHistoryToFile('wallex', currencyDiffTracker);

  return sortedCurrencies;
}

// function wallex_getTopFiveCurrenciesWithDifferences() {
//     return {
//         exchangeName: "wallex",
//         topFiveCurrencies: sortedCurrencies
//     };
// }

async function wallex_priceComp(binanceOrderbooks: BinanceOrderbooks, wallexOrderbooks: WallexOrderbooks) {
  try {
    const rowsInfo: RowInfo[] = [];

    for (const symbol of wallexBinanceCommonSymbols["binance_symbol"]) {
      let rowInfo: RowInfo | null = null;
      const binanceData = binanceOrderbooks?.usdt?.[symbol];
      const wallexDataTmn = wallexOrderbooks?.tmnPairs?.[symbol.replace("USDT", "TMN").toLowerCase()];

      if (!binanceData || !wallexDataTmn) continue;

      rowInfo = getRowTableUsdtVsTmn(binanceData, wallexDataTmn, symbol, wallexOrderbooks.exchangeName);

      if (rowInfo) rowsInfo.push(rowInfo);
      const wallexDataUsdt = wallexOrderbooks?.usdtPairs?.[symbol.toLowerCase()];

      if (!binanceData || !wallexDataUsdt) continue;
      rowInfo = getRowTableUsdtVsUsdt(binanceData, wallexDataUsdt, symbol, wallexOrderbooks.exchangeName);
      if (rowInfo && rowInfo?.rowData.value > 500000) rowsInfo.push(rowInfo);

    }

    // require('fs').writeFileSync("./fswritefiles/rowsinfo.json", JSON.stringify(rowsInfo, null, 2), 'utf-8');
    rowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent);
    const topRowsInfo = rowsInfo.slice(0, 10);
    latestRowsInfo = topRowsInfo;

    // Update currency tracker with top 10 rows
    updateCurrencyDiffTracker(rowsInfo)
    // topRowsInfo.forEach(row => {
    //   updateCurrencyDiffTracker(row.rowData.symbol, row.rowData.percent);
    // });

    // Save top 5 currencies with biggest differences and their top 5 percentages
    // const topFiveCurrencies = wallex_getTopFiveCurrenciesWithDifferences();
    // const fs = require('fs');
    // const path = require('path');
    // const filePath = path.join(process.cwd(), './fswritefiles/wallex_top_5_currencies_with_percentages.json');
    // fs.writeFileSync(filePath, JSON.stringify({
    //     timestamp: new Date().toISOString(),
    //     topFiveCurrencies: topFiveCurrencies
    // }, null, 2), 'utf-8');

    // eventEmmiter.emit("diff", JSON.stringify(latestRowsInfo));
    return latestRowsInfo;

  } catch (error) {
    console.error('Error in priceComp try-catch:', error);
  }
}
console.log("mypercent:",myPercent);

function getRowTableUsdtVsTmn(binanceOrderbook: any, wallexOrderbook: any, symbolusdt: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;
  const symbol = symbolusdt.replace("USDT", "TMN")
  const wallex_tmn_ask = parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]);
  const binance_tmn_ask = parseFloat(binanceOrderbook.ask[BinanceIndex.TMN_PRICE]);

  if (wallex_tmn_ask < binance_tmn_ask) {
    const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
    // اختلاف درصد بین ask و bid والکس
    const askBidDifferencePercentInWallex = calculatePercentageDifference(
      parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]),
      parseFloat(wallexOrderbook.bid[WallexTmnPairIndex.TMN_PRICE])
    );
    
    if (difference_percent >= +myPercent && amount_tmn > 500000) {
      // console.log("difference_percent", difference_percent, "askBidDifferencePercentInWallex", askBidDifferencePercentInWallex);
      
      if (askBidDifferencePercentInWallex < +internalPercent) {
        // console.log(`Symbol: ${symbol} | Wallex Ask TMN: ${wallex_tmn_ask} | Binance Ask TMN: ${binance_tmn_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${amount_currency} | Amount TMN: ${amount_tmn}`);

        // BUY from Wallex, then SELL in Wallex
        validateAndExecuteTrade(
          symbol,
          amount_currency,
          wallex_tmn_ask,
          'BUY'
        ).then(() => {
          // دریافت موجودی واقعی قبل از فروش (از API والکس)
          getAvailableBalance(symbol.replace("USDT", "TMN")).then(availableBalance => {
            if (availableBalance > 0) {
              // SELL in Wallex با مقدار موجود
              validateAndExecuteTrade(
                symbol,
                availableBalance, // استفاده از موجودی واقعی
                binance_tmn_ask, // کمی کمتر برای تضمین فروش
                'SELL'
              ).catch(err => console.error(`SELL trade validation failed for ${symbol}:`, err));
            } else {
              console.warn(`⚠️ No balance available for SELL: ${symbol.replace("USDT", "TMN")}`);
            }
          });
        }).catch(err => console.error(`BUY trade validation failed for ${symbol}:`, err));
      }
    }
    return createRowTable(wallexOrderbook.ask, binanceOrderbook.bid, difference_percent, amount_currency, amount_tmn, symbol, "UsdtVsTmn", exchangeName);
  }

  return null;
}

function getRowTableUsdtVsUsdt(binanceOrderbook: any, wallexOrderbook: any, symbol: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;
  const wallex_usdt_ask = parseFloat(wallexOrderbook.ask[WallexUsdtPairIndex.USDT_PRICE]);
  const binance_usdt_bid = parseFloat(binanceOrderbook.bid[BinanceIndex.USDT_PRICE]);
  if (wallex_usdt_ask < binance_usdt_bid) {
    const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.bid, wallexOrderbook.ask);
    if (difference_percent >= +myPercent && amount_tmn > 500000) {
      console.log(`\n📊(UsdtVsUsdt) Arbitrage Opportunity Found!`);
      console.log(`Symbol: ${symbol} | Wallex Ask USDT: ${wallex_usdt_ask} | Binance Bid USDT: ${binance_usdt_bid} | Difference: ${difference_percent}% | Amount: ${amount_currency}`);

      // BUY from Wallex, then SELL in Wallex
      // validateAndExecuteTrade(
      //   symbol,
      //   amount_currency,
      //   wallex_usdt_ask,
      //   'BUY'
      // ).then(() => {
      //   // دریافت موجودی واقعی قبل از فروش (از API والکس)
      //   getAvailableBalance(symbol).then(availableBalance => {
      //     if (availableBalance > 0) {
      //       // SELL in Wallex با مقدار موجود
      //       validateAndExecuteTrade(
      //         symbol,
      //         availableBalance, // استفاده از موجودی واقعی
      //         binance_usdt_bid,
      //         'SELL'
      //       ).catch(err => console.error(`SELL trade validation failed for ${symbol}:`, err));
      //     } else {
      //       console.warn(`⚠️ No balance available for SELL: ${symbol}`);
      //     }
      //   });
      // }).catch(err => console.error(`BUY trade validation failed for ${symbol}:`, err));
    }
    return createRowTable(wallexOrderbook.ask, binanceOrderbook.bid, difference_percent, amount_currency, amount_tmn, symbol, "UsdtVsUsdt", exchangeName);
  }
  return null;
}

function exsistAskBid(binanceOrderbook, wallexOrderbook): boolean {
  return (
    binanceOrderbook?.bid?.length >= 2 &&
    binanceOrderbook?.ask?.length >= 2 &&
    wallexOrderbook?.bid?.length >= 2 &&
    wallexOrderbook?.ask?.length >= 2
  );
}

function calcPercentAndAmounts(binanceBidOrder: any, wallexAskOrder: any): [number, number, number] {
  // binanceBidOrder[BinanceIndex.TMN_PRICE] = TMN Price
  // wallexAskOrder[WallexTmnPairIndex.TMN_PRICE] = TMN Price
  const percent = calculatePercentageDifference(
    +binanceBidOrder[BinanceIndex.TMN_PRICE],
    +wallexAskOrder[WallexTmnPairIndex.TMN_PRICE]
  );
  const amount = +wallexAskOrder[WallexTmnPairIndex.VOLUME_CURRENCY];
  const amountRls = Math.floor(amount * +wallexAskOrder[WallexTmnPairIndex.TMN_PRICE]);
  return [percent, amount, amountRls];
}

function calculatePercentageDifference(binancePrice: number, buyPrice: number): number {
  const priceDifference = binancePrice - buyPrice;
  const percentageDifference = (priceDifference / buyPrice) * 100;
  return Number(Math.floor(percentageDifference * 100) / 100);
}

function createRowTable(
  wallexAskOrder: any,
  binanceAskOrder: any,
  difference_percent: number,
  amount_currency: number,
  amount_tmn: number,
  symbol: string,
  statusCompare: string,
  exchangeName: string
) {
  if (statusCompare === "UsdtVsTmn") {
    const rowData: RowData = {
      symbol: symbol.replace("USDT", "TMN"),
      percent: difference_percent,
      wallex: [
        wallexAskOrder[WallexTmnPairIndex.TMN_PRICE],
        wallexAskOrder[WallexTmnPairIndex.VOLUME_CURRENCY]
      ],
      binance: binanceAskOrder[BinanceIndex.TMN_PRICE],
      value: amount_tmn,
      description: `${exchangeName} at ${wallexAskOrder[WallexTmnPairIndex.TMN_PRICE]} Binance ${binanceAskOrder[BinanceIndex.TMN_PRICE]} compare ${statusCompare}`,
      statusCompare: statusCompare
    };

    const statusbuy = statusCompare;
    return {
      exchangeName,
      statusbuy,
      rowData,
    };
  }
  if (statusCompare === "UsdtVsUsdt") {
    const rowData: RowData = {
      symbol: symbol,
      percent: difference_percent,
      wallex: [
        wallexAskOrder[WallexUsdtPairIndex.USDT_PRICE],
        wallexAskOrder[WallexUsdtPairIndex.VOLUME_CURRENCY]
      ],
      binance: binanceAskOrder[BinanceIndex.USDT_PRICE],
      value: amount_tmn,
      description: `${exchangeName} at ${wallexAskOrder[WallexUsdtPairIndex.USDT_PRICE]} Binance ${binanceAskOrder[BinanceIndex.USDT_PRICE]} compare ${statusCompare}`,
      statusCompare: statusCompare
    };
    const statusbuy = statusCompare;
    return {
      exchangeName,
      statusbuy,
      rowData,
    };
  }
}

// اجرای اولیه

export { wallex_priceComp, getLatestRowsInfo, initializeTrackerWithHistory };
