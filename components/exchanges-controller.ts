import { fetchBinancePrices } from "./exchanges/binancePriceTracker";
import { fetchWallexPrices } from "./exchanges/wallexPriceTracker";

let wallexFetched = false;

async function fetchWallexOnce() {
  if (!wallexFetched) {
    await fetchWallexPrices();
    wallexFetched = true;
  }
}

async function getAllOrderBooks() {
  console.log("Starting price trackers...");
  const binanceOrderbooks = await fetchBinancePrices();
  const wallexOrderbooks = await fetchWallexPrices();

  return {
    binanceOrderbooks,
    wallexOrderbooks
  }
}

export {
  getAllOrderBooks,
  fetchWallexOnce
};