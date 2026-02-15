// import type { WallexOrderbooks } from "../wallex_prices";
// import type { BinanceOrderbooks } from "../binance_prices";
// import { EventEmitter } from "stream";
import wallex_binance_common_symbols from "../../../commonSymbols/wallex_binance_common_symbols";
import { getAllexchangesOrderBooks, fetchExchangesOnce } from "../../2-controller/controller";
import { BinanceOrderbooks } from "../../types/types";
import { OkexOrderbooks, WallexOrderbooks } from "../../types/types";
import { saveTrackerToDatabase, loadAllDataByExchangeName, CurrencyDiffTracker, PeriodType } from "../../utils/dbManager";
// import { loadHistoryFromFile, saveHistoryToFile } from "../../utils/historyManager";
import { validateAndExecuteTrade } from "../1-purchasing/tradeValidator";
import { wallexCancelOrderById, wallexGetBalances } from "../1-purchasing/parchasing-controller";

// تابع چک موجودی از API والکس و برگرداندن مقدار واقعی
async function getAvailableBalance(symbol: string, price: number): Promise<number> {
  try {
    let baseCurrency = '';
    if (symbol.endsWith('TMN')) {
      baseCurrency = symbol.replace('TMN', ''); // e.g., BTCTMN → BTC
    } else if (symbol.endsWith('USDT')) {
      baseCurrency = symbol.replace('USDT', ''); // e.g., BTCUSDT → BTC
    }
    const availableBalanceStr = await wallexGetBalances(baseCurrency);
    const currentBalance = parseFloat(availableBalanceStr) || 0;
    console.log(`Available balance for ${symbol}: ${currentBalance}`);
    if (currentBalance * price > +process.env.WALLEX_MIN_TRADE_AMOUNT || 70000) {
      return currentBalance;
    } else {
      return 0;
    }
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
  VOLUME_CURRENCY = 1,     // "0.008717" quantity
  TMN_Amount = 2           // TMN_Price * VOLUME_CURRENCY 
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

// Global variable to store the latest rows info
let latestRowsInfo: RowInfo[] = [];
// Period-based trackers for database storage
let currancyDiffTrackerByPeriod = {
  last1h: new Map<string, CurrencyDiffTracker>(),
  last24h: new Map<string, CurrencyDiffTracker>(),
  lastWeek: new Map<string, CurrencyDiffTracker>(),
  allTime: new Map<string, CurrencyDiffTracker>()
};
// let sortedCurrencies: CurrencyDiffTracker[] = [];

// Initialize tracker with history on startup
// function initializeTrackerWithHistory() {
//   const historyMap = loadHistoryFromFile('wallex');
//   currencyDiffTracker = historyMap;
//   // sortedCurrencies = Array.from(currencyDiffTracker.values())
//   //   .sort((a, b) => b.maxDifference - a.maxDifference)
//   //   .slice(0, 5);
// }
async function initializeTrackerWithHistory() {
  try {
    // Load data from database - already filtered by period time in loadAllDataByExchangeName
    let loadedData = await loadAllDataByExchangeName('wallex');

    // فیلتر مجدد براساس period قبل از استفاده
    for (const periodType of Object.keys(loadedData) as Array<keyof typeof loadedData>) {
      for (let [symbol, record] of loadedData[periodType].entries()) {
        if (isWithinPeriod(record.last_updated || new Date().toISOString(), periodType as PeriodType)) {
          currancyDiffTrackerByPeriod[periodType].set(symbol, record);
        }
      }
    }
    // console.log("2-currancyDiffTrackerByPeriod =>", currancyDiffTrackerByPeriod.last1h.size);
    // console.log(currancyDiffTrackerByPeriod.allTime)  
  } catch (error) {
    console.log("can Not load Data Or Register Data: ", error);

  }
  console.log('✅ Wallex exchange initialized');
}

function getLatestRowsInfo() {
  return latestRowsInfo;
}

function getTehranTime(): string {
  const now = new Date();
  const tehranTime = now.toLocaleString("en-US", { timeZone: "Asia/Tehran" });

  return tehranTime;
}

function isWithinPeriod(time: string, periodType: PeriodType) {
  if (periodType === PeriodType.allTime) return true;

  const now = Date.now();
  const recordTime = new Date(time).getTime();

  const diffMs = now - recordTime;

  if (periodType === PeriodType.last1h) {
    return diffMs <= 60 * 60 * 1000;
  }

  if (periodType === PeriodType.last24h) {
    return diffMs <= 24 * 60 * 60 * 1000;
  }

  if (periodType === PeriodType.lastWeek) {
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  return false;
}

// ذخیره داده‌های جدید برای تمام periods
async function updateCurrencyDiffTracker(rowsInfo: RowInfo[]) {
  // rowsInfo → CurrencyDiffTracker برای هر period
  const currentTime = new Date().toISOString();

  for (const period of Object.values(PeriodType)) {
    const periodMap = currancyDiffTrackerByPeriod[period/*  as keyof typeof currancyDiffTrackerByPeriod */];

    rowsInfo.forEach(row => {
      const { symbol, percent, wallex, binance, value } = row.rowData;

      const tracker: CurrencyDiffTracker = {
        exchange_name: 'wallex',
        symbol,
        status_compare: row.rowData.statusCompare,
        period_type: period as PeriodType,
        difference: percent,
        exchange_buy_price: parseFloat(wallex[0]),
        binance_sell_price: parseFloat(binance),
        buy_volume_tmn: value,
        last_updated: currentTime
      };

      // اگر symbol نیست یا percent بیشتر است، به روز کن
      if (!periodMap.has(symbol) || percent > periodMap.get(symbol)!.difference) {
        periodMap.set(symbol, tracker);
      }
      
    });
  }

  // فیلتر کردن symbols بر اساس زمان قبل از ذخیره
  filterTrackerByPeriodTime(currancyDiffTrackerByPeriod);
  // ذخیره به دیتابیس
  await saveTrackerToDatabase("wallex", currancyDiffTrackerByPeriod);
}

// فیلتر کردن symbols بر اساس زمان برای هر period
function filterTrackerByPeriodTime(trackerByPeriod: {
  last1h: Map<string, CurrencyDiffTracker>;
  last24h: Map<string, CurrencyDiffTracker>;
  lastWeek: Map<string, CurrencyDiffTracker>;
  allTime: Map<string, CurrencyDiffTracker>;
}) {
  const now = Date.now();

  // last1h: حذف کن اگر قدیمی‌تر از 1 ساعت
  currancyDiffTrackerByPeriod.last1h.forEach((tracker, symbol) => {
    const updatedTime = new Date(tracker.last_updated || new Date()).getTime();
    const diffMs = now - updatedTime;
    if (diffMs > 60 * 60 * 1000) {
      currancyDiffTrackerByPeriod.last1h.delete(symbol);
    }
  });

  let last1h = [...currancyDiffTrackerByPeriod.last1h.entries()]
    .sort((a, b) => b[1].difference - a[1].difference)
    .slice(0, 20);

  currancyDiffTrackerByPeriod.last1h = new Map(last1h);
  // last24h: حذف کن اگر قدیمی‌تر از 24 ساعت
  currancyDiffTrackerByPeriod.last24h.forEach((tracker, symbol) => {
    const updatedTime = new Date(tracker.last_updated || new Date()).getTime();
    const diffMs = now - updatedTime;
    if (diffMs > 24 * 60 * 60 * 1000) {
      currancyDiffTrackerByPeriod.last24h.delete(symbol);
    }
  });
  
  let last24h = [...currancyDiffTrackerByPeriod.last24h.entries()]
    .sort((a, b) => b[1].difference - a[1].difference)
    .slice(0, 20);
  currancyDiffTrackerByPeriod.last24h = new Map(last24h)
  // lastWeek: حذف کن اگر قدیمی‌تر از 7 روز
  currancyDiffTrackerByPeriod.lastWeek.forEach((tracker, symbol) => {
    const updatedTime = new Date(tracker.last_updated || new Date()).getTime();
    const diffMs = now - updatedTime;
    if (diffMs > 7 * 24 * 60 * 60 * 1000) {
      currancyDiffTrackerByPeriod.lastWeek.delete(symbol);
    }
  });

  let lastWeek = [...currancyDiffTrackerByPeriod.lastWeek.entries()]
    .sort((a, b) => b[1].difference - a[1].difference)
    .slice(0, 20);
  currancyDiffTrackerByPeriod.lastWeek = new Map(lastWeek);

  let allTime = [...trackerByPeriod.allTime.entries()]
    .sort((a, b) => b[1].difference - a[1].difference)
    .slice(0, 50);
  
  currancyDiffTrackerByPeriod.allTime = new Map(allTime);
  // allTime: همه نگه داریم (بدون فیلتر)
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
console.log("mypercent:", myPercent);

function getRowTableUsdtVsTmn(binanceOrderbook: any, wallexOrderbook: any, symbolusdt: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;
  const symbol = symbolusdt.replace("USDT", "TMN")
  const wallex_tmn_ask = parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]);
  const binance_tmn_ask = parseFloat(binanceOrderbook.ask[BinanceIndex.TMN_PRICE]);

  if (wallex_tmn_ask < binance_tmn_ask) {
    const [difference_percent, currencyAmount, amountTmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
    // اختلاف درصد بین ask و bid والکس
    const askBidDifferencePercentInWallex = calculatePercentageDifference(
      parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]),
      parseFloat(wallexOrderbook.bid[WallexTmnPairIndex.TMN_PRICE])
    );

    if (difference_percent >= +myPercent) {
      // BUY from Wallex, then SELL in Wallex
      validateAndExecuteTrade(
        symbol,
        currencyAmount,
        wallex_tmn_ask,
        'BUY',
        amountTmn,
        askBidDifferencePercentInWallex
      ).then((condition) => {
        // دریافت موجودی واقعی قبل از فروش (از API والکس)
        if (condition.success) {
          getAvailableBalance(symbol, wallex_tmn_ask).then(availableBalance => {
            if (availableBalance > 0) {
              // SELL in Wallex با مقدار موجود
              setTimeout(() => {
                validateAndExecuteTrade(
                  symbol,
                  availableBalance, // استفاده از موجودی واقعی
                  binance_tmn_ask, // کمی کمتر برای تضمین فروش
                  'SELL'
                ).then(() => { }).
                  catch(err => console.error(`SELL trade validation failed for ${symbol}:`, err));
              }, 150);
            } else {
              setTimeout(() => {
                wallexCancelOrderById(condition.orderId || "").then((res) => {
                  console.log(`Cancelled BUY order for ${symbol} due to insufficient balance for SELL.${res.message}`);
                });
                console.warn(`⚠️ No balance available for SELL: ${symbol}`);
              }, 150);

            }
          });
        }
      }).catch(err => console.error(`BUY trade validation failed for ${symbol}:`, err));

    }
    return createRowTable(wallexOrderbook.ask, binanceOrderbook.bid, difference_percent, currencyAmount, amountTmn, symbol, "UsdtVsTmn", exchangeName);
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
  const currencyAmount = +wallexAskOrder[WallexTmnPairIndex.VOLUME_CURRENCY];
  const amountTmn = +wallexAskOrder[WallexTmnPairIndex.TMN_Amount];
  return [percent, currencyAmount, amountTmn];
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
