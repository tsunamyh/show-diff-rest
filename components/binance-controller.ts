import { fetchBinancePrices } from "./binance/binancePriceTracker";

async function fetchBinanceOrderBooks() {
  try {
    const binanceOrderbooks = await fetchBinancePrices();
    return binanceOrderbooks;
  } catch (error) {
    console.error("Error fetching Binance order books:", error);
    throw error;
  }
}

export {
  fetchBinanceOrderBooks
};