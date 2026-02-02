import { fetchNobitexPrices } from "../1-tracker/nobitexPriceTracker";
import { fetchOkexPrices } from "../1-tracker/okexPriceTracker";
import { fetchWallexPrices, fetchWallexUsdtToTmn } from "../1-tracker/wallexPriceTracker";

let wallexFetched = false;
let nobitexFetched = false;

async function fetchWallexOnce() {
  if (!wallexFetched) {
    await fetchWallexUsdtToTmn();
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
  console.log("nobitexorderbooks :", nobitexOrderbooks.tmnPairs["dogeirt"]);
  console.log("wallexOrderbokks: ", wallexOrderbooks.tmnPairs["dogetmn"]);
  
  
  return {
    wallexOrderbooks,
    nobitexOrderbooks,
    okexOrderbooks
  }
}

export {
  getExchangesOrderBooks,
  fetchWallexOnce,
  fetchNobitexOnce,
};