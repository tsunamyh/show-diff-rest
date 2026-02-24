// import type { WallexOrderbooks } from "../wallex_prices";
// import type { BinanceOrderbooks } from "../binance_prices";
// import { EventEmitter } from "stream";
import wallex_binance_common_symbols from "../../../commonSymbols/wallex_binance_common_symbols";
import { getAllexchangesOrderBooks, fetchExchangesOnce } from "../../2-controller/controller";
import { BinanceOrderbooks } from "../../types/types";
import { OkexOrderbooks, WallexOrderbooks } from "../../types/types";
import { saveTrackerToDatabase, loadAllDataByExchangeName, CurrencyDiffTracker, PeriodType, OpenOrder, saveOrdersToDatabase } from "../../utils/dbManager";
// import { loadHistoryFromFile, saveHistoryToFile } from "../../utils/historyManager";
import { validateAndBuyTrade, validateAndSellTrade } from "../1-purchasing/tradeValidator";
import { wallexCancelOrderById, wallexGetBalances } from "../1-purchasing/parchasing-controller";
import { lossProtectionMonitor } from "../1-purchasing/lossProtectionMonitor";
// تابع چک موجودی از API والکس و برگرداندن مقدار واقعی
async function getAvailableBalance(symbol: string): Promise<number> {
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

    return currentBalance;
  } catch (error) {
    console.error(`Error fetching balance for ${symbol}:`, error);
    return 0;
  }
}

const wallexBinanceCommonSymbols = wallex_binance_common_symbols.symbols;
const myPercent = process.env.MYPERCENT || "2.2";
//  * مثال: [tmnPrice, volumeCurrency, usdtPrice]
enum WallexUsdtPairIndex {
  TMN_PRICE = 0,           // "11504590301.58"
  VOLUME_CURRENCY = 1,     // "0.008676"
  USDT_PRICE = 2,           // "91762.17"
  TMN_AMOUNT = 3            // TMN_Price * VOLUME_CURRENCY
}

// * مثال: [tmnPrice, volumeCurrency, tmn_amount]
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
  rowData: CurrencyDiffTracker;
}

// interface OpenOrders {
//   exchange_name: string;     // exchange name
//   symbol: string;            // symbol
//   // usdtvstmn/usdtvsusdt
//   // wallex ask tmn
//   // wallex ask ttr
//   // wallex bid ttr
//   // wallex bid tmn
//   // wallex qauntity
//   // binance ask ttr
//   // binance ask tmn
//   // binance bid ttr
//   // binance bid tmn
//   // difference %
//   // myPercent
//   // spread %
//   // time           
// }
let openOrdersForMonitoring = new Map<string, OpenOrder[]>()
// Global variable to store the latest rows info
let latestRowsInfo: RowInfo[] = [];
// Period-based trackers for database storage
let currancyDiffTrackerByPeriod = {
  last1h: new Map<string, CurrencyDiffTracker>(),
  last24h: new Map<string, CurrencyDiffTracker>(),
  lastWeek: new Map<string, CurrencyDiffTracker>(),
  allTime: new Map<string, CurrencyDiffTracker>()
};

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
    // console.log("2:>>",currancyDiffTrackerByPeriod.last1h)  
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
  // Convert ISO string to timestamp (always UTC)
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
      const { symbol, difference } = row.rowData;
      row.rowData.period_type = period;

      // const tracker: CurrencyDiffTracker = {
      //   exchange_name: 'wallex',
      //   symbol: row.rowData.symbol,
      //   status_compare: row.rowData.status_compare,
      //   period_type: period as PeriodType,
      //   difference: row.rowData.difference,
      //   exchange_ask_tmn: ,
      //   binance_sell_price: parseFloat(binance),
      //   buy_volume_tmn: value,
      //   last_updated: currentTime
      // };

      // اگر symbol نیست یا percent بیشتر است، به روز کن
      if (!periodMap.has(symbol) || difference > periodMap.get(symbol)!.difference) {
        periodMap.set(symbol, row.rowData);
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

async function wallex_priceComp(binanceOrderbooks: BinanceOrderbooks, wallexOrderbooks: WallexOrderbooks) {
  try {
    const rowsInfo: RowInfo[] = [];

    for (const symbol of wallexBinanceCommonSymbols["binance_symbol"]) {
      const binanceData = binanceOrderbooks?.usdt?.[symbol];

      const wallexDataTmn = wallexOrderbooks?.tmnPairs?.[symbol.replace("USDT", "TMN").toLowerCase()];
      if (exsistAskBid(binanceData, wallexDataTmn)) {
        let rowInfo_usdtvstmn: RowInfo | null = null;
        rowInfo_usdtvstmn = getRowTableUsdtVsTmn(binanceData, wallexDataTmn, symbol, wallexOrderbooks.exchangeName);
        if (rowInfo_usdtvstmn) rowsInfo.push(rowInfo_usdtvstmn);
      }

      const wallexDataUsdt = wallexOrderbooks?.usdtPairs?.[symbol.toLowerCase()];
      if (exsistAskBid(binanceData, wallexDataUsdt)) {
        let rowInfo_usdtvsusdt: RowInfo | null = null;
        rowInfo_usdtvsusdt = getRowTableUsdtVsUsdt(binanceData, wallexDataUsdt, symbol, wallexOrderbooks.exchangeName);
        if (rowInfo_usdtvsusdt) rowsInfo.push(rowInfo_usdtvsusdt);
      }
    }

    // require('fs').writeFileSync("./fswritefiles/rowsinfo.json", JSON.stringify(rowsInfo, null, 2), 'utf-8');
    rowsInfo.sort((a, b) => b.rowData.difference - a.rowData.difference);
    latestRowsInfo = rowsInfo.slice(0, 10);

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

  const symbol = symbolusdt.replace("USDT", "TMN")
  const wallex_ask_tmn = parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]);
  const wallex_bid_tmn = parseFloat(wallexOrderbook.bid[WallexTmnPairIndex.TMN_PRICE]);
  const binance_ask_tmn = parseFloat(binanceOrderbook.ask[BinanceIndex.TMN_PRICE]);
  const binance_bid_tmn = parseFloat(binanceOrderbook.bid[BinanceIndex.TMN_PRICE]);

  if (wallex_ask_tmn < binance_ask_tmn) {
    const difference_percent = calculatePercentageDifference(
      +binanceOrderbook.ask[BinanceIndex.TMN_PRICE],
      +wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]
    );
    // اختلاف درصد بین ask و bid والکس
    const askBidDifferencePercentInWallex = calculatePercentageDifference(
      parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]),
      parseFloat(wallexOrderbook.bid[WallexTmnPairIndex.TMN_PRICE])
    );

    const rowData: CurrencyDiffTracker = {
      exchange_name: exchangeName,
      symbol: symbol.replace("USDT", "TMN"),
      difference: difference_percent,
      status_compare: "UsdtVsTmn",
      // period_type: "PeriodType.last1h",
      exchange_ask_tmn: wallex_ask_tmn.toFixed(),
      // exchange_bid_tmn: wallex_bid_tmn.toFixed(),
      // exchange_ask_usdt: "",
      // exchange_bid_usdt: "",
      binance_ask_tmn: binance_ask_tmn.toFixed(),
      // binance_bid_tmn: binance_bid_tmn.toFixed(),
      binance_ask_usdt: binanceOrderbook.ask[BinanceIndex.USDT_PRICE],
      // binance_bid_usdt: binanceOrderbook.bid[BinanceIndex.USDT_PRICE],
      exchange_quantity_tmn: wallexOrderbook.ask[WallexTmnPairIndex.TMN_Amount],
      // exchange_quantity_usdt: "",
      exchange_quantity_currency: wallexOrderbook.ask[WallexTmnPairIndex.VOLUME_CURRENCY],
      spread: askBidDifferencePercentInWallex.toFixed(),
      my_percent: myPercent.toString(),
      description: `${exchangeName} at ${wallex_ask_tmn} Binance ${binance_ask_tmn} compare UsdtVsUsdt`,
      last_updated: new Date().toISOString()
    };

    if (difference_percent >= +myPercent) {
      // BUY from Wallex, then SELL in Wallex
      validateAndBuyTrade(
        symbol,
        Number(rowData.exchange_quantity_currency),
        wallex_ask_tmn,
        'BUY',
        Number(rowData.exchange_quantity_tmn),
        askBidDifferencePercentInWallex
      ).then((buyResult) => {
        // دریافت موجودی واقعی قبل از فروش (از API والکس)
        if (buyResult.success) {
          getAvailableBalance(symbol)
            .then(availableBalance => {
              if (availableBalance * wallex_ask_tmn > +process.env.WALLEX_MIN_TRADE_AMOUNT || 70000) {
                let order: OpenOrder = {
                  price: buyResult.price,
                  origQty: buyResult.origQty,
                  origSum: buyResult.origSum,
                  executedPrice: buyResult.executedPrice,
                  executedQty: buyResult.executedQty,
                  executedSum: buyResult.executedSum,
                  executedPercent: buyResult.executedPercent.toString(),
                  binance_bid_tmn: binance_bid_tmn.toString(),
                  binance_bid_usdt: binanceOrderbook.bid[BinanceIndex.USDT_PRICE],
                  exchange_bid_tmn: wallex_bid_tmn.toString(),
                  exchange_bid_usdt: wallexOrderbook.bid[WallexUsdtPairIndex.USDT_PRICE],
                  order_id: buyResult.orderId,
                  max_loss_percent: "2",
                  status_position: "buy"
                };
                sendOrderTosaveDatabase(rowData, order);
                // SELL in Wallex با مقدار موجود
                validateAndSellTrade(
                  symbol,
                  availableBalance, // استفاده از موجودی واقعی
                  binance_ask_tmn, // ??کمی کمتر برای تضمین فروش
                  'SELL'
                ).then((sellResult) => {
                  // Start loss protection monitoring
                  if (sellResult.success && buyResult.orderId && sellResult.orderId) {
                    const maxLossPercent = 2; // 2% max loss threshold
                    const buyPrice = parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]);
                    lossProtectionMonitor.startMonitoring({
                      symbol,
                      buyOrderId: buyResult.orderId,
                      sellOrderId: sellResult.orderId,
                      buyPrice,
                      quantity: availableBalance,
                      buyedAt: new Date(),
                      maxLossPercent
                    });
                  }
                }).
                  catch(err => console.error(`SELL trade validation failed for ${symbol}:`, err));

              } else {
                wallexCancelOrderById(buyResult.orderId || "").then((res) => {
                  console.log(`Cancelled BUY order for ${symbol} due to insufficient balance for SELL.${res.message}`);
                });
                console.warn(`⚠️ No balance available for SELL: ${symbol}`);

              }
            });
        }
      }).catch(err => console.error(`BUY trade validation failed for ${symbol}:`, err));
    }

    return {
      exchangeName,
      statusbuy: "UsdtVsTmn",
      rowData,
    };
    // return createRowTable(wallexOrderbook.ask, binanceOrderbook.bid, difference_percent, currencyAmount, amountTmn, symbol, "UsdtVsTmn", exchangeName);
  }

  return null;
}

function getRowTableUsdtVsUsdt(binanceOrderbook: any, wallexOrderbook: any, symbol: string, exchangeName: string) {
  const wallex_ask_usdt = parseFloat(wallexOrderbook.ask[WallexUsdtPairIndex.USDT_PRICE]);
  const wallex_bid_usdt = parseFloat(wallexOrderbook.bid[WallexUsdtPairIndex.USDT_PRICE]);
  const binance_ask_usdt = parseFloat(binanceOrderbook.ask[BinanceIndex.USDT_PRICE]);
  const binance_bid_usdt = parseFloat(binanceOrderbook.bid[BinanceIndex.USDT_PRICE]);

  if (wallex_ask_usdt < binance_ask_usdt) {
    const difference_percent = calculatePercentageDifference(
      +binanceOrderbook.ask[BinanceIndex.USDT_PRICE],
      +wallexOrderbook.ask[WallexUsdtPairIndex.USDT_PRICE]
    );
    // اختلاف درصد بین ask و bid والکس
    const askBidDifferencePercentInWallex = calculatePercentageDifference(
      parseFloat(wallexOrderbook.ask[WallexUsdtPairIndex.USDT_PRICE]),
      parseFloat(wallexOrderbook.bid[WallexUsdtPairIndex.USDT_PRICE])
    );

    const rowData: CurrencyDiffTracker = {
      exchange_name: exchangeName,
      symbol: symbol,
      difference: difference_percent,
      status_compare: "UsdtVsUsdt",
      period_type: PeriodType.last1h,
      exchange_ask_usdt: wallex_ask_usdt.toFixed(),
      // exchange_bid_usdt: wallex_bid_usdt.toFixed(),
      exchange_ask_tmn: wallexOrderbook.ask[WallexUsdtPairIndex.TMN_PRICE],
      // exchange_bid_tmn: wallexOrderbook.bid[WallexUsdtPairIndex.TMN_PRICE],
      binance_ask_tmn: binance_ask_usdt.toFixed(),
      // binance_bid_tmn: binance_bid_usdt.toFixed(),
      binance_ask_usdt: binanceOrderbook.ask[BinanceIndex.USDT_PRICE],
      // binance_bid_usdt: binanceOrderbook.bid[BinanceIndex.USDT_PRICE],
      exchange_quantity_tmn: wallexOrderbook.ask[WallexUsdtPairIndex.TMN_AMOUNT],
      // exchange_quantity_usdt: "",
      exchange_quantity_currency: wallexOrderbook.ask[WallexUsdtPairIndex.VOLUME_CURRENCY],
      spread: askBidDifferencePercentInWallex.toFixed(),
      my_percent: myPercent.toString(),
      // description: `${exchangeName} at ${wallex_ask_usdt} Binance ${binance_ask_usdt} compare UsdtVsUsdt`,
      last_updated: new Date().toISOString()
    };

    if (difference_percent >= +myPercent) {
      // BUY from Wallex, then SELL in Wallex
      validateAndBuyTrade(
        symbol,
        +rowData.exchange_quantity_currency,
        wallex_ask_usdt,
        'BUY',
        +rowData.exchange_quantity_currency,
        askBidDifferencePercentInWallex
      ).then((buyResult) => {
        // دریافت موجودی واقعی قبل از فروش (از API والکس)
        if (buyResult.success) {
          getAvailableBalance(symbol)
            .then(availableBalance => {
              if (availableBalance * wallex_ask_usdt > +process.env.WALLEX_MIN_TRADE_AMOUNT || 70000) {
                // SELL in Wallex با مقدار موجود
                validateAndSellTrade(
                  symbol,
                  availableBalance, // استفاده از موجودی واقعی
                  binance_ask_usdt, // ??کمی کمتر برای تضمین فروش
                  'SELL'
                ).then((sellResult) => {
                  // Start loss protection monitoring
                  if (sellResult.success && buyResult.orderId && sellResult.orderId) {
                    const maxLossPercent = 2; // 2% max loss threshold
                    const buyPrice = parseFloat(wallexOrderbook.ask[WallexTmnPairIndex.TMN_PRICE]);
                    lossProtectionMonitor.startMonitoring({
                      symbol,
                      buyOrderId: buyResult.orderId,
                      sellOrderId: sellResult.orderId,
                      buyPrice,
                      quantity: availableBalance,
                      buyedAt: new Date(),
                      maxLossPercent
                    });
                  }
                }).
                  catch(err => console.error(`SELL trade validation failed for ${symbol}:`, err));

              } else {
                wallexCancelOrderById(buyResult.orderId || "").then((res) => {
                  console.log(`Cancelled BUY order for ${symbol} due to insufficient balance for SELL.${res.message}`);
                });
                console.warn(`⚠️ No balance available for SELL: ${symbol}`);

              }
            });
        }
      }).catch(err => console.error(`BUY trade validation failed for ${symbol}:`, err));
    }

    return {
      exchangeName,
      statusbuy: "UsdtVsUsdt",
      rowData,
    };
    // return createRowTable(wallexOrderbook.ask, binanceOrderbook.bid, difference_percent, currencyAmount, amountTmn, symbol, "UsdtVsTmn", exchangeName);
  }

  return null;
}

function exsistAskBid(binanceOrderbook: any, wallexOrderbook: any): boolean {
  return (
    binanceOrderbook?.bid?.length > 0 &&
    binanceOrderbook?.ask?.length > 0 &&
    wallexOrderbook?.bid?.length > 0 &&
    wallexOrderbook?.ask?.length > 0
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

async function sendOrderTosaveDatabase(rowData: CurrencyDiffTracker, order: OpenOrder) {
  let position: OpenOrder & CurrencyDiffTracker = Object.assign(rowData, order)
  await saveOrdersToDatabase("wallex", position);
}
// اجرای اولیه

export { wallex_priceComp, getLatestRowsInfo, initializeTrackerWithHistory };
