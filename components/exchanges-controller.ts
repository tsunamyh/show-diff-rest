import { fetchOkexPrices } from "./exchanges/tracker/okexPriceTracker";
import { fetchWallexPrices } from "./exchanges/tracker/wallexPriceTracker";

let wallexFetched = false;

async function fetchWallexOnce() {
  if (!wallexFetched) {
    await fetchWallexPrices();
    wallexFetched = true;
  }
}

async function getExchangesOrderBooks() {
  // console.log("Starting price trackers...");
  const wallexOrderbooks = await fetchWallexPrices();
  const okexOrderbooks = await fetchOkexPrices();
  // console.log("okexorderbooks:",okexOrderbooks);
  
  return {
    wallexOrderbooks,
    okexOrderbooks
  }
}

export {
  getExchangesOrderBooks,
  fetchWallexOnce,
};