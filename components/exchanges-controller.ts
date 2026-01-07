import { fetchNobitexPrices } from "./exchanges/tracker/nobitexPriceTracker";
import { fetchOkexPrices } from "./exchanges/tracker/okexPriceTracker";
import { fetchWallexPrices } from "./exchanges/tracker/wallexPriceTracker";

let wallexFetched = false;
let nobitexFetched = false;

async function fetchWallexOnce() {
  if (!wallexFetched) {
    await fetchWallexPrices();
    wallexFetched = true;
  }
}

async function fetchNobitexOnce() {
  if (!nobitexFetched) {
    await fetchNobitexPrices();
    nobitexFetched = true;
  }
}

async function getExchangesOrderBooks() {
  // console.log("Starting price trackers...");
  const wallexOrderbooks = await fetchWallexPrices();
  const nobitexOrderbooks = await fetchNobitexPrices();
  const okexOrderbooks = await fetchOkexPrices();
  // console.log("okexorderbooks:",okexOrderbooks);
  
  return {
    wallexOrderbooks,
    nobitexOrderbooks,
    okexOrderbooks
  }
}

export {
  getExchangesOrderBooks,
  fetchWallexOnce,
};