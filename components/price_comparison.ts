import binance_wallex_common_symbols from "../commonSymbols/common_symbols";
import wallexOrderbooks , {WallexOrderbooks} from "../wallex_prices_tracker"; 
import binanceOrderbooks , {BinanceOrderbooks} from "../binance_prices";

const commonSymbols: string[] = binance_wallex_common_symbols.symbols.binance_symbol;

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
const myPercent = process.env.MYPERCENT || 1
function priceComp() {
    const rowsInfo = [];
    for (const symbol of commonSymbols) {
        const wallexsymbol = symbol.replace("USDT", "TMN").toLowerCase();
        
        const rowInfo = getRowTable(binanceOrderbooks.usdt[symbol], wallexOrderbooks.tmnPairs[wallexsymbol], symbol);
    }
}

function getRowTable(binanceOrderbook: BinanceOrderbooks["usdt"][string], wallexOrderbook: WallexOrderbooks["tmnPairs"][string],symbol){
    console.log("getrowtablefunc",symbol);
   
    if(!exsistAskBid(binanceOrderbook,wallexOrderbook)) return;

    const wallex_tmn_ask = parseFloat(wallexOrderbook.ask[0]);
    const binance_tmn_ask = parseFloat(binanceOrderbook.ask[1]);
    if(wallex_tmn_ask < binance_tmn_ask){
        const [difference_percent, amount_currency, amount_tmn] = calcPercentAndAmounts(binanceOrderbook.ask, wallexOrderbook.ask);
        if(difference_percent >= +myPercent){
            console.log(`Symbol: ${symbol} | Wallex Ask TMN: ${wallex_tmn_ask} | Binance Ask TMN: ${binance_tmn_ask} | Difference Percent: ${difference_percent}% | Amount Currency: ${amount_currency} | Amount TMN: ${amount_tmn}`);
            //handle trade here
        }
        return [createRowTable(wallexOrderbook.ask, binanceOrderbook.ask, difference_percent, amount_currency, amount_tmn, symbol) ];
    }

}

function exsistAskBid(binanceOrderbook , wallexOrderbook): boolean {
  // console.log("nobOrderSymbol:",nobOrderSymbol);
  return (
    binanceOrderbook?.bid.length >= 2 &&
    binanceOrderbook?.ask.length >= 2 &&
    wallexOrderbook?.bid.length >= 2 &&
    wallexOrderbook?.ask.length >= 2
  );
}

function calcPercentAndAmounts(binanceAskOrder: BinanceOrderbooks["usdt"][string]["ask"], wallexAskOrder: WallexOrderbooks["usdtPairs"][string]["ask"]): [number, number, number] {

  const percent = calculatePercentageDifference(+binanceAskOrder[1], +wallexAskOrder[0]);

  const amount = +wallexAskOrder[1];
  const amountRls = Math.floor(amount * +wallexAskOrder[0]);
  return [percent, amount, amountRls]
}

function calculatePercentageDifference(binancePrice: number, buyPrice: number): number {
  const priceDifference = binancePrice - buyPrice ;
  const percentageDifference = (priceDifference / buyPrice) * 100;

  return Number(percentageDifference.toFixed(2));
}

function createRowTable(
    wallexAskOrder: WallexOrderbooks["usdtPairs"][string]["ask"],
    binanceAskOrder: BinanceOrderbooks["usdt"][string]["ask"],
    difference_percent: number,
    amount_currency: number,
    amount_tmn: number,
    symbol: string
){
    const rowData: RowData = {
        symbol: symbol,
        percent: difference_percent,
        wallex: [wallexAskOrder[0], wallexAskOrder[1]],
        binance: binanceAskOrder[1],
        value: amount_tmn,
        description: `Buy ${symbol} from Wallex at ${wallexAskOrder[0]} USDT and sell on Binance at ${binanceAskOrder[1]} USDT`
    }
    console.log("rowData ", rowData);
    
    const statusbuy =  "wallex Buy"
    return {
      statusbuy,
      rowData,
    };
}

priceComp()
// const commonSymbols: string[] = binance_wallex_common_symbols.symbols.binance_symbol.map(s => s.toUpperCase());

// const results: { symbol: string, binanceBid: number, wallexAsk: number, diff: number }[] = [];

// for (const symbol of commonSymbols) {
//   const binance = binanceOrderbooks[symbol]?.btcusdt || binanceOrderbooks[symbol]?.[`${symbol.toLowerCase()}usdt`];
//   const wallex = wallexOrderbooks[symbol]?.btcusdt || wallexOrderbooks[symbol]?.[`${symbol.toLowerCase()}usdt`];

//   if (binance && wallex) {
//     const binanceBid = parseFloat(binance.bid[1] || binance.bid[0]);
//     const wallexAsk = parseFloat(wallex.ask[1] || wallex.ask[0]);
//     const diff = binanceBid - wallexAsk;
//     if (diff < 0) {
//       results.push({ symbol, binanceBid, wallexAsk, diff });
//     }
//   }
// }

// نمایش ارزهایی که در والکس ارزان‌تر هستند
// console.log("ارزهای ارزان‌تر در والکس:");
// results.forEach(r => {
//   console.log(`${r.symbol}: Binance Bid = ${r.binanceBid}, Wallex Ask = ${r.wallexAsk}, Diff = ${r.diff}`);
// });
