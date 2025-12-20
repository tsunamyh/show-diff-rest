import axios, { AxiosResponse } from "axios";
// import { HttpsProxyAgent } from "https-proxy-agent";
import symbols from '../../commonSymbols/okex_binance_common_symbols';
// import {
//   MarketDataCoinex,
//   OrderBook,
//   ResponseData,
//   SortedOrderBooks,
// } from "./extypes";
import { writeFile } from "fs/promises";

const proxyUrl = process.env.PROXYURL

// const agent = new HttpsProxyAgent(proxyUrl)

const coinBaseUrl: URL = new URL("https://api.coinex.com/v2/");

const coinInstance = axios.create({
  baseURL: coinBaseUrl.toString(),
//   httpsAgent: agent,
});

async function httpGetCoinexOrderBook(
  pair: string
) {
  const response = await coinInstance.get(
    "/spot/depth",
    {
      params: {
        market: pair,
        limit: 5,
        interval: "0.01",
      },
    }
  );

  const coinexOrderBooks = sortCoinexOrderBooks(response.data.data);

  return coinexOrderBooks;
}

function sortCoinexOrderBooks(data) {
  const ask: number[] = data.depth.asks[0];
  const bid: number[] = data.depth.bids[0];
  return {
    [data.market]: { ask, bid },
  };
}

async function httpGetCoinexOrderBooks(pair : string) {
  let sortedCoinexOrderBooksPromise
  if (pair == "all") {
    sortedCoinexOrderBooksPromise =
    symbols.symbols.okex_symbol.map(async function (symbol:string) {
      return httpGetCoinexOrderBook(symbol);
    });
  } else {
    sortedCoinexOrderBooksPromise = [httpGetCoinexOrderBook(pair)];
  }

  const sortedCoinexOrderBooksArray = await Promise.allSettled(
    sortedCoinexOrderBooksPromise
  );

  // تبدیل اوردرهای تکی کوینکس شبیه به تایپ اوردربوک والکس
  const sortedCoinexOrderBooks = {};
  sortedCoinexOrderBooksArray.forEach(function (orderbook) {
    if (orderbook.status == "fulfilled") {
      Object.assign(sortedCoinexOrderBooks, orderbook.value);
    }
  });


  return sortedCoinexOrderBooks;
}

export { httpGetCoinexOrderBooks };
