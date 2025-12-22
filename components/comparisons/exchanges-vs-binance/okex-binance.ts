import okex_binance_common_symbols from "../../../commonSymbols/okex_binance_common_symbols";
import { BinanceOrderbooks, OkexOrderbooks } from "../../types/types";

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
    binanceAskOrder: any,
    difference_percent: number,
    amount_currency: number,
    amount_tmn: number,
    symbol: string,
    exchangeName: string
) {
    const rowData: RowData = {
        symbol: symbol,
        percent: difference_percent,
        wallex: [
            okexAskOrder[OkExUsdtPairIndex.TMN_PRICE],
            okexAskOrder[OkExUsdtPairIndex.QUANTITY]
        ],
        binance: binanceAskOrder[BinanceIndex.TMN_PRICE],
        value: amount_tmn,
        description: `${exchangeName} at ${okexAskOrder[OkExUsdtPairIndex.TMN_PRICE]} Binance ${binanceAskOrder[BinanceIndex.TMN_PRICE]} compare UsdtVsUsdt`
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
        const binance_tmn_ask = parseFloat(binanceData.ask[BinanceIndex.TMN_PRICE]);

        if (okex_tmn_ask < binance_tmn_ask) {
            const okex_quantity = parseFloat(okexData.ask[OkExUsdtPairIndex.QUANTITY]);
            
            const difference_percent = calculatePercentageDifference(binance_tmn_ask, okex_tmn_ask);
            const amount_tmn = Math.floor(okex_quantity * okex_tmn_ask);

            if (difference_percent >= +myPercent && amount_tmn > 500000) {
                console.log(`Symbol: ${symbol} | okex Ask TMN: ${okex_tmn_ask} | Binance Ask TMN: ${binance_tmn_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${okex_quantity} | Amount TMN: ${amount_tmn}`);
            }

            const rowInfo = createRowTable(
                okexData.ask,
                binanceData.ask,
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

    return rowsInfo;
}

export { okex_priceComp };