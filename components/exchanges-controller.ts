import { fetchOkexPrices } from "./exchanges/okexPriceTracker";
import { fetchWallexPrices } from "./exchanges/wallexPriceTracker";

let wallexFetched = false;

async function fetchWallexOnce() {
  if (!wallexFetched) {
    await fetchWallexPrices();
    wallexFetched = true;
  }
}

async function getExchangesOrderBooks() {
  console.log("Starting price trackers...");
  const wallexOrderbooks = fetchWallexPrices();
  const okexOrderbooks = fetchOkexPrices();
  console.log("okexorderbooks:",okexOrderbooks);
  
  return {
    wallexOrderbooks,
    // okexOrderbooks
  }
}

export {
  getExchangesOrderBooks,
  fetchWallexOnce,
};