import okex_binance_common_symbols from "../../../commonSymbols/okex_binance_common_symbols";
import { BinanceOrderbooks, OkexOrderbooks } from "../../types/types";
import { loadHistoryFromFile, saveHistoryToFile } from "../../utils/historyManager";

const okexBinanceCommonSymbols: string[] = okex_binance_common_symbols.symbols.binance_symbol;

// * مثال: [tmnPrice, quantity, usdtPrice]
enum OkExUsdtPairIndex {
    TMN_PRICE = 0,           // "131000"
    QUANTITY = 1,            // "1792.1"
    USDT_PRICE = 2           // "1"
}

enum BinanceIndex {
    USDT_PRICE = 0,          // "91991.32000000"
    TMN_PRICE = 1            // "11533319753.68"
}

interface RowData {
    symbol: string;
    percent: number;
    okex: [string, string];
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

const myPercent = process.env.MYPERCENT || 1;

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
    const historyMap = loadHistoryFromFile('okex');
    currencyDiffTracker = historyMap;
    sortedCurrencies = Array.from(currencyDiffTracker.values())
        .sort((a, b) => b.maxDifference - a.maxDifference)
        .slice(0, 5);
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

function updateCurrencyDiffTracker(topRowsInfo: RowInfo[]) {
    topRowsInfo.forEach(row => {
        const { symbol, percent, okex, binance, value } = row.rowData;
        const currentTime = getTehranTime();
        const percentRecord: PercentageRecord = {
            time: currentTime,
            value: percent,
            exchangeBuyPrice: parseFloat(okex[0]),
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
    
    // Save to file after update
    saveHistoryToFile('okex', currencyDiffTracker);
    
    return sortedCurrencies;
}

function okex_getTopFiveCurrenciesWithDifferences() {
    return {
        exchangeName: "okex",
        topFiveCurrencies: sortedCurrencies
    };
}

// تبدیل سمبل binance (BTCUSDT) به سمبل okex (BTC-USDT)
function convertBinanceSymbolToOkexSymbol(binanceSymbol: string): string {
    // BTCUSDT -> BTC-USDT
    // Remove USDT suffix, add it back with dash
    const symbolWithoutUsdt = binanceSymbol.replace('USDT', '');
    return `${symbolWithoutUsdt}-USDT`.toLowerCase();
}

function calculatePercentageDifference(binancePrice: number, buyPrice: number): number {
    const priceDifference = binancePrice - buyPrice;
    const percentageDifference = (priceDifference / buyPrice) * 100;
    return Number(percentageDifference.toFixed(2));
}

function createRowTable(
    okexAskOrder: any,
    binanceBidOrder: any,
    difference_percent: number,
    amount_currency: number,
    amount_tmn: number,
    symbol: string,
    exchangeName: string
) {
    const rowData: RowData = {
        symbol: symbol,
        percent: difference_percent,
        okex: [
            okexAskOrder[OkExUsdtPairIndex.TMN_PRICE],
            okexAskOrder[OkExUsdtPairIndex.QUANTITY]
        ],
        binance: binanceBidOrder[BinanceIndex.TMN_PRICE],
        value: amount_tmn,
        description: `${exchangeName} at ${okexAskOrder[OkExUsdtPairIndex.TMN_PRICE]} Binance ${binanceBidOrder[BinanceIndex.TMN_PRICE]} compare UsdtVsUsdt`,
        statusCompare: "UsdtVsUsdt"
    };

    const statusbuy = "UsdtVsUsdt";
    return {
        exchangeName,
        statusbuy,
        rowData,
    };
}

async function okex_priceComp(binanceOrderbooks: BinanceOrderbooks, okexOrderbooks: OkexOrderbooks) {
    const rowsInfo: RowInfo[] = [];

    if (!okexOrderbooks || !okexOrderbooks.usdtPairs) {
        return rowsInfo;
    }

    for (const symbol of okexBinanceCommonSymbols) {
        const binanceData = binanceOrderbooks?.usdt?.[symbol];
        const okexSymbol = convertBinanceSymbolToOkexSymbol(symbol);
        const okexData = okexOrderbooks.usdtPairs[okexSymbol];

        if (!binanceData || !okexData) {
            continue;
        }

        // Check if we have valid bid/ask
        if (!binanceData?.bid?.length || !binanceData?.ask?.length || 
            !okexData?.bid?.length || !okexData?.ask?.length) {
            continue;
        }

        // okex format: [tmnPrice, quantity, usdtPrice]
        const okex_tmn_ask = parseFloat(okexData.ask[OkExUsdtPairIndex.TMN_PRICE]);
        const binance_tmn_bid = parseFloat(binanceData.bid[BinanceIndex.TMN_PRICE]);

        if (okex_tmn_ask < binance_tmn_bid) {
            const okex_quantity = parseFloat(okexData.ask[OkExUsdtPairIndex.QUANTITY]);
            
            const difference_percent = calculatePercentageDifference(binance_tmn_bid, okex_tmn_ask);
            const amount_tmn = Math.floor(okex_quantity * okex_tmn_ask);

            if (difference_percent >= +myPercent && amount_tmn > 500000) {
                console.log(`Symbol: ${symbol} | okex Ask TMN: ${okex_tmn_ask} | Binance Ask TMN: ${binance_tmn_bid} | Difference Percent: ${difference_percent}% | Amount Currency: ${okex_quantity} | Amount TMN: ${amount_tmn}`);
            }

            const rowInfo = createRowTable(
                okexData.ask,
                binanceData.bid,
                difference_percent,
                okex_quantity,
                amount_tmn,
                symbol,
                "okex"
            );

            if (rowInfo?.rowData.value > 500000) {
                rowsInfo.push(rowInfo);
            }
        }
    }

    // Sort and get top rows
    rowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent);
    const topRowsInfo = rowsInfo.slice(0, 10);

    // Update currency tracker with top 10 rows
    updateCurrencyDiffTracker(topRowsInfo);

    // Save top 5 currencies with biggest differences and their top 5 percentages
    const topFiveCurrencies = okex_getTopFiveCurrenciesWithDifferences();
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), './fswritefiles/okex_top_5_currencies_with_percentages.json');
    fs.writeFileSync(filePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        topFiveCurrencies: topFiveCurrencies
    }, null, 2), 'utf-8');

    return topRowsInfo;
}

export { okex_priceComp, okex_getTopFiveCurrenciesWithDifferences, initializeTrackerWithHistory };