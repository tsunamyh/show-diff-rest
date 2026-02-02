import { fetchBinancePrices } from "../1-tracker/binance/binancePriceTracker";

async function fetchBinanceOrderBooks() {
  try {
    const binanceOrderbooks = await fetchBinancePrices();
    // console.log("binanceorderbooks",binanceOrderbooks.usdt["DOGEUSDT"]);  
    return binanceOrderbooks;
  } catch (error) {
    console.error("Error fetching Binance order books:", error);
    throw error;
  }
}

export {
  fetchBinanceOrderBooks
};