import { fetchWallexOnce, getAllOrderBooks } from "./exchanges-controller";
import type { WallexOrderbooks } from "../wallex_prices";
import type { BinanceOrderbooks } from "../binance_prices";
import { EventEmitter } from "stream";
import fs from "fs";

const binance_wallex_common_symbols = require("../commonSymbols/common_symbols").default;

const commonSymbols: string[] = binance_wallex_common_symbols.symbols.binance_symbol.map(s => s.toUpperCase());

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

/**
 * ساختار داده‌های مختلف:
 * 
 * Wallex TMN Pairs: [tmnPrice, volumeCurrency]
 * Wallex USDT Pairs: [tmnPrice, volumeCurrency, usdtPrice]
 * Binance: [usdtPrice, tmnPrice]
 */

export const PriceAccessors = {
  // Wallex TMN Pairs
  wallex_tmn: {
    getAskPrice: (data: any): number => parseFloat(data.ask[0]),
    getBidPrice: (data: any): number => parseFloat(data.bid[0]),
    getAskVolume: (data: any): number => parseFloat(data.ask[1]),
    getBidVolume: (data: any): number => parseFloat(data.bid[1]),
  },

  // Wallex USDT Pairs
  wallex_usdt: {
    getAskTmnPrice: (data: any): number => parseFloat(data.ask[0]),
    getBidTmnPrice: (data: any): number => parseFloat(data.bid[0]),
    getAskVolume: (data: any): number => parseFloat(data.ask[1]),
    getBidVolume: (data: any): number => parseFloat(data.bid[1]),
    getAskUsdtPrice: (data: any): number => parseFloat(data.ask[2]),
    getBidUsdtPrice: (data: any): number => parseFloat(data.bid[2]),
  },

  // Binance
  binance: {
    getAskUsdtPrice: (data: any): number => parseFloat(data.ask[0]),
    getBidUsdtPrice: (data: any): number => parseFloat(data.bid[0]),
    getAskTmnPrice: (data: any): number => parseFloat(data.ask[1]),
    getBidTmnPrice: (data: any): number => parseFloat(data.bid[1]),
  },
};

// Global variable to store the latest rows info
let latestRowsInfo: RowInfo[] = [];

export function getLatestRowsInfo() {
  return latestRowsInfo;
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
        let rowInfo : RowInfo | null = null;
        const binanceData = binanceOrderbooks?.usdt?.[symbol];
        const wallexDataTmn = wallexOrderbooks?.tmnPairs?.[symbol.replace("USDT", "TMN").toLowerCase()];
        
        if (!binanceData || !wallexDataTmn) continue;
        
        rowInfo = getRowTableTmn(binanceData, wallexDataTmn, symbol);
        
        if (rowInfo) rowsInfo.push(rowInfo);
        const wallexDataUsdt = wallexOrderbooks?.usdtPairs?.[symbol.toLowerCase()];

        if (!binanceData || !wallexDataUsdt) continue;
        rowInfo = getRowTableUsdt(binanceData, wallexDataUsdt, symbol);
        if (rowInfo && rowInfo?.rowData.value > 500000) rowsInfo.push(rowInfo);

    }

    fs.writeFileSync("rowsinfo.json", JSON.stringify(rowsInfo, null, 2), 'utf-8');
    rowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent);
    const topRowsInfo = rowsInfo.slice(0, 10);
    latestRowsInfo = topRowsInfo;
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


function getRowTableTmn(binanceOrderbook: any, wallexOrderbook: any, symbol: string) {
    if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;

    // استفاده از PriceAccessors
    const wallex_tmn_ask = PriceAccessors.wallex_tmn.getAskPrice(wallexOrderbook);
    const binance_tmn_ask = PriceAccessors.binance.getAskTmnPrice(binanceOrderbook);
    
    if (wallex_tmn_ask < binance_tmn_ask) {
        const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
        if (difference_percent >= +myPercent && amount_tmn > 500000) {
            console.log(`Symbol: ${symbol} | Wallex Ask TMN: ${wallex_tmn_ask} | Binance Ask TMN: ${binance_tmn_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${amount_currency} | Amount TMN: ${amount_tmn}`);
        }
        return createRowTable(wallexOrderbook.ask, binanceOrderbook.ask, difference_percent, amount_currency, amount_tmn, symbol, "TMN");
    }
    
    return null;
}

function getRowTableUsdt(binanceOrderbook: any, wallexOrderbook: any, symbol: string) {
    if (!exsistAskBid(binanceOrderbook, wallexOrderbook)) return null;
    
    // استفاده از PriceAccessors
    const wallex_usdt_ask = PriceAccessors.wallex_usdt.getAskUsdtPrice(wallexOrderbook);
    const binance_usdt_ask = PriceAccessors.binance.getAskUsdtPrice(binanceOrderbook);
    
    if (wallex_usdt_ask < binance_usdt_ask) {
        const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
        if (difference_percent >= +myPercent && amount_tmn > 500000) {
            console.log(`Symbol: ${symbol} | Wallex Ask USDT: ${wallex_usdt_ask} | Binance Ask USDT: ${binance_usdt_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${amount_currency} | Amount TMN: ${amount_tmn}`);
        }
        return createRowTable(wallexOrderbook.ask, binanceOrderbook.ask, difference_percent, amount_currency, amount_tmn, symbol, "USDT");
    }
    return null;
}

function exsistAskBid(binanceOrderbook , wallexOrderbook): boolean {
  return (
    binanceOrderbook?.bid?.length >= 2 &&
    binanceOrderbook?.ask?.length >= 2 &&
    wallexOrderbook?.bid?.length >= 2 &&
    wallexOrderbook?.ask?.length >= 2
  );
}

function calcPercentAndAmounts(binanceAskOrder: any, wallexAskOrder: any): [number, number, number] {
  const percent = calculatePercentageDifference(+binanceAskOrder[1], +wallexAskOrder[0]);
  const amount = +wallexAskOrder[1];
  const amountRls = Math.floor(amount * +wallexAskOrder[0]);
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
    statusCompare: string
) {
    if(statusCompare==="TMN"){
      const rowData: RowData = {
          symbol: symbol,
          percent: difference_percent,
          wallex: [wallexAskOrder[0], wallexAskOrder[1]],
          binance: binanceAskOrder[1],
          value: amount_tmn,
          description: `Buy ${symbol} from Wallex at ${wallexAskOrder[0]} USDT and sell on Binance at ${binanceAskOrder[1]} USDT`
      };
      // console.log("rowData ", rowData);

      const statusbuy =  "wallex Buy usdt to TMN";
      return {
        statusbuy,
        rowData,
      };
    }
    if(statusCompare==="USDT"){
      const rowData: RowData = {
          symbol: symbol,
          percent: difference_percent,
          wallex: [wallexAskOrder[0], wallexAskOrder[1]],
          binance: binanceAskOrder[1],
          value: amount_tmn,
          description: `Buy ${symbol} from Wallex at ${wallexAskOrder[1]} USDT and sell on Binance at ${binanceAskOrder[1]} USDT`
      };
      // console.log("rowData ", rowData);
      const statusbuy =  "wallex Buy usdt to USDT";
      return {
        statusbuy,
        rowData,
      };
    }
}

// اجرای اولیه
fetchWallexOnce().finally(async () => {
  await priceComp();
});

// اپدیت هر 10 ثانیه
// setInterval(async () => {
//   try {
//     await priceComp();
//   } catch (error) {
//     console.error('Error in priceComp:', error);
//   }
// }, 10000);

// console.log("Price comparison started. Updating every 10 seconds...");
export { eventEmmiter, intervalFunc };
