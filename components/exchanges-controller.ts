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
  const wallexOrderbooks = await fetchWallexPrices();
  const okexOrderbooks = "await fetchOkexPrices()";
  return {
    wallexOrderbooks,
    okexOrderbooks
  }
}

export {
  getExchangesOrderBooks,
  fetchWallexOnce,
};