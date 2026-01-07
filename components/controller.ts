import { fetchBinanceOrderBooks } from "./binance-controller";
import { fetchNobitexOnce, fetchWallexOnce, getExchangesOrderBooks } from "./exchanges-controller";

async function getAllexchangesOrderBooks() {
    const binanceOrderbooks = fetchBinanceOrderBooks();
    const exchangesOrderbooks = getExchangesOrderBooks();
    const allOrderBooks = await Promise.allSettled([
        binanceOrderbooks, 
        exchangesOrderbooks,
    ]);
    return allOrderBooks;
}

async function fetchExchangesOnce() {
    return {
        fetchWallexOnce,
        fetchNobitexOnce,
    }
}

export {
    getAllexchangesOrderBooks,
    fetchExchangesOnce
}