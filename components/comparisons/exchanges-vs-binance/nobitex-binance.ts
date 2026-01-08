import nobitex_binance_common_symbols from "../../../commonSymbols/nobitex_binance_common_symbols";
import { getAllexchangesOrderBooks, fetchExchangesOnce } from "../../controller";
import { BinanceOrderbooks } from "../../types/types";
import { NobitexOrderbooks } from "../../types/types";
import { loadHistoryFromFile, saveHistoryToFile } from "../../utils/historyManager";
import { validateAndExecuteTrade } from "../../exchanges/purchasing/tradeValidator";
// import { nobitexCancelOrderById, nobitexGetBalances } from "../../exchanges/purchasing/parchasing-controller";

// تابع چک موجودی از API نوبیتکس و برگرداندن مقدار واقعی
// async function getAvailableBalance(symbol: string, price: number): Promise<number> {
//   try {
//     let baseCurrency = '';
//     if (symbol.endsWith('IRT')) {
//       baseCurrency = symbol.replace('IRT', ''); // e.g., BTCIRT → BTC
//     } else if (symbol.endsWith('USDT')) {
//       baseCurrency = symbol.replace('USDT', ''); // e.g., BTCUSDT → BTC
//     }
//     const availableBalanceStr = await nobitexGetBalances(baseCurrency);
//     const currentBalance = parseFloat(availableBalanceStr) || 0;
//     console.log(`Available balance for ${symbol}: ${currentBalance}`);
//     if (currentBalance * price > +process.env.NOBITEX_MIN_TRADE_AMOUNT || 70000) {
//       return currentBalance;
//     } else {
//       return 0;
//     }  
//   } catch (error) {
//     console.error(`Error fetching balance for ${symbol}:`, error);
//     return 0;
//   }
// }

const nobitexBinanceCommonSymbols = nobitex_binance_common_symbols.symbols;

// مثال USDT: [irtPrice (calc), quantity, usdtPrice (original)]
enum NobitexUsdtPairIndex {
  IRT_PRICE = 0,           // calculated from USDT price * rate
  VOLUME_CURRENCY = 1,     // "0.008676"
  USDT_PRICE = 2           // "3600.50" (original USDT price)
}

// مثال IRT: [irtPrice, quantity]
enum NobitexIrtPairIndex {
  IRT_PRICE = 0,           // "151500000"
  VOLUME_CURRENCY = 1,     // "0.008717" quantity
  IRT_AMOUNT = 2           // will be calculated: IRT_PRICE * VOLUME_CURRENCY
}

// مثال: [usdtPrice, irtPrice]
enum BinanceIndex {
  USDT_PRICE = 0,          // "91991.32000000"
  IRT_PRICE = 1            // "11533319753.68"
}

interface RowData {
  symbol: string;
  percent: number;
  nobitex: [string, string];
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
  const historyMap = loadHistoryFromFile('nobitex');
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
  rowsInfo.forEach(row => {
    const { symbol, percent, nobitex, binance, value } = row.rowData;
    const currentTime = getTehranTime();
    const percentRecord: PercentageRecord = {
      time: currentTime,
      value: percent,
      exchangeBuyPrice: parseFloat(nobitex[0]),
      binanceSellPrice: parseFloat(binance),
      buyVolume: value
    };

    if (!currencyDiffTracker.has(symbol)) {
      currencyDiffTracker.set(symbol, {
        symbol,
        statusCompare: row.rowData.statusCompare,
        maxDifference: percent,
        percentages: [percentRecord]
      });
    } else {
      const tracker = currencyDiffTracker.get(symbol)!;
      const lastRecord = tracker.percentages[0];

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
  saveHistoryToFile('nobitex', currencyDiffTracker);

  return sortedCurrencies;
}

async function nobitex_priceComp(binanceOrderbooks: BinanceOrderbooks, nobitexOrderbooks: NobitexOrderbooks) {
  try {
    const rowsInfo: RowInfo[] = [];

    // Check if nobitex orderbooks exist
    if (!nobitexOrderbooks || (!nobitexOrderbooks?.tmnPairs && !nobitexOrderbooks?.usdtPairs)) {
      console.warn('⚠️ Nobitex orderbooks not available');
      return [];
    }

    for (const symbol of nobitexBinanceCommonSymbols["binance_symbol"]) {
      let rowInfo: RowInfo | null = null;
      const binanceData = binanceOrderbooks?.usdt?.[symbol];
      const nobitexDataIrt = nobitexOrderbooks?.tmnPairs?.[symbol.replace("USDT", "IRT").toLowerCase()];

      if (!binanceData || !nobitexDataIrt) continue;

      rowInfo = getRowTableUsdtVsIrt(binanceData, nobitexDataIrt, symbol, nobitexOrderbooks.exchangeName);
      
      if (rowInfo) rowsInfo.push(rowInfo);
      
      const nobitexDataUsdt = nobitexOrderbooks?.usdtPairs?.[symbol.toLowerCase()];
      
      if (!binanceData || !nobitexDataUsdt) continue;
      rowInfo = getRowTableUsdtVsUsdt(binanceData, nobitexDataUsdt, symbol, nobitexOrderbooks.exchangeName);
      if (rowInfo && rowInfo?.rowData.value > 500000) rowsInfo.push(rowInfo);

    }

    rowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent);
    console.log(rowsInfo.length,"llllllllllllllllll",rowsInfo[rowsInfo.length -1]);
    
    const topRowsInfo = rowsInfo.slice(0, 10);
    latestRowsInfo = topRowsInfo;
    // console.log(`✅ Nobitex priceComp found ${rowsInfo.length} opportunities, top ${topRowsInfo.length}:`, topRowsInfo.map(r => `${r.rowData.symbol}: ${r.rowData.percent}%`));
    

    // Update currency tracker with top 10 rows
    updateCurrencyDiffTracker(rowsInfo)

    return latestRowsInfo;

  } catch (error) {
    console.error('Error in nobitex_priceComp try-catch:', error);
    return [];
  }
}
console.log("mypercent:", myPercent);

function getRowTableUsdtVsIrt(binanceOrderbook: any, nobitexOrderbook: any, symbolusdt: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, nobitexOrderbook)) return null;
  const symbol = symbolusdt.replace("USDT", "IRT")
  const nobitex_irt_ask = parseFloat(nobitexOrderbook.ask[NobitexIrtPairIndex.IRT_PRICE]);
  const binance_irt_ask = parseFloat(binanceOrderbook.ask[BinanceIndex.IRT_PRICE]);
  
  if (nobitex_irt_ask < binance_irt_ask) {
    console.log(symbol,nobitex_irt_ask,binance_irt_ask);
    const [difference_percent, currencyAmount, amountIrt] = calcPercentAndAmounts(binanceOrderbook.ask, nobitexOrderbook.ask);
    // console.log(difference_percent,currencyAmount,amountIrt,"nnnnnnnnnnnnnnnn");
    // اختلاف درصد بین ask و bid نوبیتکس
    const askBidDifferencePercentInNobitex = calculatePercentageDifference(
      parseFloat(nobitexOrderbook.ask[NobitexIrtPairIndex.IRT_PRICE]),
      parseFloat(nobitexOrderbook.bid[NobitexIrtPairIndex.IRT_PRICE])
    );

    if (difference_percent >= +myPercent) {
      // BUY from Nobitex, then SELL in Nobitex
      // validateAndExecuteTrade(
      //   symbol,
      //   currencyAmount,
      //   nobitex_irt_ask,
      //   'BUY',
      //   amountIrt,
      //   askBidDifferencePercentInNobitex
      // ).then((condition) => {
      //   // دریافت موجودی واقعی قبل از فروش (از API نوبیتکس)
      //   if (condition.success) {
      //     getAvailableBalance(symbol, nobitex_irt_ask).then(availableBalance => {
      //       if (availableBalance > 0) {
      //         // SELL in Nobitex با مقدار موجود
      //         setTimeout(() => {
      //           validateAndExecuteTrade(
      //             symbol,
      //             availableBalance, // استفاده از موجودی واقعی
      //             binance_irt_ask, // کمی کمتر برای تضمین فروش
      //             'SELL'
      //           ).then(() => {}).
      //           catch(err => console.error(`SELL trade validation failed for ${symbol}:`, err));
      //         }, 150);
      //       } else {
      //         setTimeout(() => {
      //           nobitexCancelOrderById(condition.orderId || "").then((res) => {
      //             console.log(`Cancelled BUY order for ${symbol} due to insufficient balance for SELL.${res.message}`);
      //           });
      //           console.warn(`⚠️ No balance available for SELL: ${symbol}`);
      //         }, 150);  
                
      //       }
      //     });
      //   }
      // }).catch(err => console.error(`BUY trade validation failed for ${symbol}:`, err));

    }
    return createRowTable(nobitexOrderbook.ask, binanceOrderbook.bid, difference_percent, currencyAmount, amountIrt, symbol, "UsdtVsTmn", exchangeName);
  }

  return null;
}

function getRowTableUsdtVsUsdt(binanceOrderbook: any, nobitexOrderbook: any, symbol: string, exchangeName: string) {
  if (!exsistAskBid(binanceOrderbook, nobitexOrderbook)) return null;
  const nobitex_usdt_ask = parseFloat(nobitexOrderbook.ask[NobitexUsdtPairIndex.USDT_PRICE]);
  const binance_usdt_bid = parseFloat(binanceOrderbook.bid[BinanceIndex.USDT_PRICE]);
  if (nobitex_usdt_ask < binance_usdt_bid) {
    const [difference_percent, amount_currency, amount_irt] = calcPercentAndAmounts(binanceOrderbook.bid, nobitexOrderbook.ask);
    // console.log(difference_percent,amount_currency,amount_irt);
    
    if (difference_percent >= +myPercent && amount_irt > 500000) {
      console.log(`\n📊(UsdtVsUsdt) Arbitrage Opportunity Found!`);
      console.log(`Symbol: ${symbol} | Nobitex Ask USDT: ${nobitex_usdt_ask} | Binance Bid USDT: ${binance_usdt_bid} | Difference: ${difference_percent}% | Amount: ${amount_currency}`);
    }
    return createRowTable(nobitexOrderbook.ask, binanceOrderbook.bid, difference_percent, amount_currency, amount_irt, symbol, "UsdtVsUsdt", exchangeName);
  }
  return null;
}

function exsistAskBid(binanceOrderbook, nobitexOrderbook): boolean {
  return (
    binanceOrderbook?.bid?.length >= 2 &&
    binanceOrderbook?.ask?.length >= 2 &&
    nobitexOrderbook?.bid?.length >= 2 &&
    nobitexOrderbook?.ask?.length >= 2
  );
}

function calcPercentAndAmounts(binanceBidOrder: any, nobitexAskOrder: any): [number, number, number] {
  // binanceBidOrder[BinanceIndex.IRT_PRICE] = IRT Price in Binance
  // nobitexAskOrder[NobitexIrtPairIndex.IRT_PRICE] = IRT Price in Nobitex
  
  const nobitexPrice = +nobitexAskOrder[NobitexIrtPairIndex.IRT_PRICE];
  const binancePrice = +binanceBidOrder[BinanceIndex.IRT_PRICE];
  
  const percent = calculatePercentageDifference(binancePrice, nobitexPrice);
  const currencyAmount = +nobitexAskOrder[NobitexIrtPairIndex.VOLUME_CURRENCY];
  const amountIrt = nobitexPrice * currencyAmount; // Calculate amount
  
  return [percent, currencyAmount, amountIrt];
}

function calculatePercentageDifference(binancePrice: number, buyPrice: number): number {
  const priceDifference = binancePrice - buyPrice;
  const percentageDifference = (priceDifference / buyPrice) * 100;
  return Number(Math.floor(percentageDifference * 100) / 100);
}

function createRowTable(
  nobitexAskOrder: any,
  binanceAskOrder: any,
  difference_percent: number,
  amount_currency: number,
  amount_irt: number,
  symbol: string,
  statusCompare: string,
  exchangeName: string
) {
  if (statusCompare === "UsdtVsTmn") {
    const rowData: RowData = {
      symbol: symbol.replace("USDT", "IRT"),
      percent: difference_percent,
      nobitex: [
        nobitexAskOrder[NobitexIrtPairIndex.IRT_PRICE],
        nobitexAskOrder[NobitexIrtPairIndex.VOLUME_CURRENCY]
      ],
      binance: binanceAskOrder[BinanceIndex.IRT_PRICE],
      value: amount_irt,
      description: `${exchangeName} at ${nobitexAskOrder[NobitexIrtPairIndex.IRT_PRICE]} Binance ${binanceAskOrder[BinanceIndex.IRT_PRICE]} compare ${statusCompare}`,
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
      nobitex: [
        nobitexAskOrder[NobitexUsdtPairIndex.USDT_PRICE],
        nobitexAskOrder[NobitexUsdtPairIndex.VOLUME_CURRENCY]
      ],
      binance: binanceAskOrder[BinanceIndex.USDT_PRICE],
      value: amount_irt,
      description: `${exchangeName} at ${nobitexAskOrder[NobitexUsdtPairIndex.USDT_PRICE]} Binance ${binanceAskOrder[BinanceIndex.USDT_PRICE]} compare ${statusCompare}`,
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

export { nobitex_priceComp, getLatestRowsInfo, initializeTrackerWithHistory };
