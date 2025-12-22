import { getAllexchangesOrderBooks } from "../controller";
import { BinanceOrderbooks, OkexOrderbooks, WallexOrderbooks } from "../types/types";
import { wallex_priceComp } from "./exchanges-vs-binance/wallex-binance";

async function intervalFunc(): Promise<NodeJS.Timeout> {
    return setInterval(async function () {
        try {
            const [binanceOrderbooksPromise, exchangesOrderbooksPromise] = await getAllexchangesOrderBooks();
            let binanceOrderbooks: BinanceOrderbooks;
            let wallexOrderbooks: WallexOrderbooks, okexOrderbooks: OkexOrderbooks;

            if (binanceOrderbooksPromise.status === "rejected") {
                console.error('Error fetching order books:', {
                    binanceError: binanceOrderbooksPromise.status === "rejected" ? binanceOrderbooksPromise.reason : null,
                });
                return;
            }
            if (binanceOrderbooksPromise.status === "fulfilled") {
                if (!binanceOrderbooksPromise.value) return;
                binanceOrderbooks = binanceOrderbooksPromise.value;

            }
            if (exchangesOrderbooksPromise.status === "fulfilled") {
                if (!exchangesOrderbooksPromise.value) return;
                wallexOrderbooks = exchangesOrderbooksPromise.value.wallexOrderbooks;
                await wallex_priceComp(binanceOrderbooks, wallexOrderbooks);
                okexOrderbooks = exchangesOrderbooksPromise.value.okexOrderbooks;
            }
        } catch (error) {
            console.error('Error in priceComp:', error);
        }
    }, 10000);
}

export { intervalFunc };