import { fetchBinanceOrderBooks } from "./binance-controller";
import { fetchWallexOnce, getExchangesOrderBooks } from "./exchanges-controller";

async function getAllexchangesOrderBooks() {
    const binanceOrderbooks = fetchBinanceOrderBooks();
    const wallexOrderbooks = (await getExchangesOrderBooks()).wallexOrderbooks;
    const allOrderBooks = await Promise.allSettled([
        binanceOrderbooks, 
        wallexOrderbooks,
    ]);
    return allOrderBooks;
}

async function fetchExchangesOnce() {
    return {
        fetchWallexOnce,
    }
}

export {
    getAllexchangesOrderBooks,
    fetchExchangesOnce
}