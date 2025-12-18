import { fetchWallexOnce, getAllOrderBooks } from "./exchanges-controller";
// import type { WallexOrderbooks } from "../wallex_prices";
// import type { BinanceOrderbooks } from "../binance_prices";
import { EventEmitter } from "stream";

const binance_wallex_common_symbols = require("../commonSymbols/common_symbols").default;

const commonSymbols: string[] = binance_wallex_common_symbols.symbols.binance_symbol.map(s => s.toUpperCase());

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
}

interface RowInfo {
  statusbuy: string;
  rowData: RowData;
}

const myPercent = process.env.MYPERCENT || 1;

// Global variable to store the latest rows info
let latestRowsInfo: RowInfo[] = [];

// Global variable to track top 5 currencies with biggest differences and their top 5 percentages
interface PercentageRecord {
  time: string;
  value: number;
}

interface CurrencyDiffTracker {
  symbol: string;
  maxDifference: number;
  percentages: PercentageRecord[];
}

let currencyDiffTracker: Map<string, CurrencyDiffTracker> = new Map();
let sortedCurrencies: CurrencyDiffTracker[] = [];

function getLatestRowsInfo() {
  return latestRowsInfo;
}

function getTehranTime(): string {
  const now = new Date();
  const tehranTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  return tehranTime.toISOString();
}

function shouldAddPercentage(lastRecord: PercentageRecord | undefined, newValue: number, minIntervalSeconds: number = 60): boolean {
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

function updateCurrencyDiffTracker(topRowsInfo: RowInfo[]) {
  console.log("currencyDiffTracker:", currencyDiffTracker);

  topRowsInfo.forEach(row => {
    const { symbol, percent } = row.rowData;
    const currentTime = getTehranTime();
    const percentRecord: PercentageRecord = {
      time: currentTime,
      value: percent
    };

    if (!currencyDiffTracker.has(symbol)) {
      currencyDiffTracker.set(symbol, {
        symbol,
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
    .slice(0, 5);
  return sortedCurrencies;
}

function getTopFiveCurrenciesWithDifferences() {
  return sortedCurrencies;
}

async function priceComp() {
  const orderBooks = await getAllOrderBooks();
  // console.log("orderBooks ::::",orderBooks?.wallexOrderbooks);

  if (!orderBooks?.binanceOrderbooks || !orderBooks?.wallexOrderbooks) {
    console.log('Waiting for data...');
    return;
  }

  const { binanceOrderbooks, wallexOrderbooks } = orderBooks;

  const rowsInfo = [];

  for (const symbol of commonSymbols) {
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
  updateCurrencyDiffTracker(topRowsInfo)
  // topRowsInfo.forEach(row => {
  //   updateCurrencyDiffTracker(row.rowData.symbol, row.rowData.percent);
  // });

  // Save top 5 currencies with biggest differences and their top 5 percentages
  const topFiveCurrencies = getTopFiveCurrenciesWithDifferences();
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(process.cwd(), './fswritefiles/top_5_currencies_with_percentages.json');
  fs.writeFileSync(filePath, JSON.stringify({
    timestamp: new Date().toISOString(),
    topFiveCurrencies: topFiveCurrencies
  }, null, 2), 'utf-8');

  eventEmmiter.emit("diff", JSON.stringify(latestRowsInfo));

}

const eventEmmiter = new EventEmitter();
eventEmmiter.setMaxListeners(6);

async function intervalFunc(): Promise<NodeJS.Timeout> {
  return setInterval(async function () {
    try {
      await priceComp();
    } catch (error) {
      console.error('Error in priceComp:', error);
    }
  }, 10000);
}

function getRowTableUsdtVsTmn(binanceOrderbook: any, wallexOrderbook: any, symbol: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;

  const wallex_tmn_ask = parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]);
  const binance_tmn_ask = parseFloat(binanceOrderbook.ask[BinanceIndex.TMN_PRICE]);

  if (wallex_tmn_ask < binance_tmn_ask) {
    const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
    if (difference_percent >= +myPercent && amount_tmn > 500000) {
      console.log(`Symbol: ${symbol} | Wallex Ask TMN: ${wallex_tmn_ask} | Binance Ask TMN: ${binance_tmn_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${amount_currency} | Amount TMN: ${amount_tmn}`);
    }
    return createRowTable(wallexOrderbook.ask, binanceOrderbook.ask, difference_percent, amount_currency, amount_tmn, symbol, "UsdtVsTmn", exchangeName);
  }

  return null;
}

function getRowTableUsdtVsUsdt(binanceOrderbook: any, wallexOrderbook: any, symbol: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;
  const wallex_usdt_ask = parseFloat(wallexOrderbook.ask[WallexUsdtPairIndex.USDT_PRICE]);
  const binance_usdt_ask = parseFloat(binanceOrderbook.ask[BinanceIndex.USDT_PRICE]);
  if (wallex_usdt_ask < binance_usdt_ask) {
    const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
    if (difference_percent >= +myPercent && amount_tmn > 500000) {
      console.log(`Symbol: ${symbol} | Wallex Ask USDT: ${wallex_usdt_ask} | Binance Ask USDT: ${binance_usdt_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${amount_currency} | Amount TMN: ${amount_tmn}`);
    }
    return createRowTable(wallexOrderbook.ask, binanceOrderbook.ask, difference_percent, amount_currency, amount_tmn, symbol, "UsdtVsUsdt", exchangeName);
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

function calcPercentAndAmounts(binanceAskOrder: any, wallexAskOrder: any): [number, number, number] {
  // binanceAskOrder[BinanceIndex.TMN_PRICE] = TMN Price
  // wallexAskOrder[WallexTmnIndex.TMN_PRICE] = TMN Price
  const percent = calculatePercentageDifference(
    +binanceAskOrder[BinanceIndex.TMN_PRICE],
    +wallexAskOrder[WallexTmnPairIndex.TMN_PRICE]
  );
  const amount = +wallexAskOrder[WallexTmnPairIndex.VOLUME_CURRENCY];
  const amountRls = Math.floor(amount * +wallexAskOrder[WallexTmnPairIndex.TMN_PRICE]);
  return [percent, amount, amountRls];
}

function calculatePercentageDifference(binancePrice: number, buyPrice: number): number {
  const priceDifference = binancePrice - buyPrice;
  const percentageDifference = (priceDifference / buyPrice) * 100;
  return Number(percentageDifference.toFixed(2));
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
      symbol: symbol,
      percent: difference_percent,
      wallex: [
        wallexAskOrder[WallexTmnPairIndex.TMN_PRICE],
        wallexAskOrder[WallexTmnPairIndex.VOLUME_CURRENCY]
      ],
      binance: binanceAskOrder[BinanceIndex.TMN_PRICE],
      value: amount_tmn,
      description: `${exchangeName} at ${wallexAskOrder[WallexTmnPairIndex.TMN_PRICE]} Binance ${binanceAskOrder[BinanceIndex.TMN_PRICE]} compare ${statusCompare}`
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
      description: `${exchangeName} at ${wallexAskOrder[WallexUsdtPairIndex.USDT_PRICE]} Binance ${binanceAskOrder[BinanceIndex.USDT_PRICE]} compare ${statusCompare}`
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
fetchWallexOnce().finally(async () => {
  await priceComp();
});

export { eventEmmiter, intervalFunc, getLatestRowsInfo, getTopFiveCurrenciesWithDifferences };
