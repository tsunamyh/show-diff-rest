import { EventEmitter } from "stream";
import { getAllexchangesOrderBooks } from "../controller";
import { BinanceOrderbooks, OkexOrderbooks, WallexOrderbooks } from "../types/types";
import { wallex_getTopFiveCurrenciesWithDifferences, wallex_priceComp } from "./exchanges-vs-binance/wallex-binance";
import { okex_getTopFiveCurrenciesWithDifferences, okex_priceComp } from "./exchanges-vs-binance/okex-binance";

const eventEmmiter = new EventEmitter();
eventEmmiter.setMaxListeners(6);
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
                const wallexTopRowsInfo = await wallex_priceComp(binanceOrderbooks, wallexOrderbooks);
                okexOrderbooks = exchangesOrderbooksPromise.value.okexOrderbooks;
                const okexTopRowsInfo = await okex_priceComp(binanceOrderbooks, okexOrderbooks);
                // console.log("okexTopRowsInfo:", okexTopRowsInfo);
                
                const combinedTopRowsInfo = [...wallexTopRowsInfo, ...okexTopRowsInfo];
                combinedTopRowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent)
                const combinedTopRowsInfo10 = combinedTopRowsInfo.slice(0, 12);

                eventEmmiter.emit("diff", JSON.stringify(combinedTopRowsInfo10));
                const wallexTopFives = wallex_getTopFiveCurrenciesWithDifferences();
                eventEmmiter.emit("diff", JSON.stringify({
                    status: "maxDiff",
                    maxDiff: wallexTopFives
                }));
                const okexTopFives = okex_getTopFiveCurrenciesWithDifferences();
                eventEmmiter.emit("diff", JSON.stringify({
                    status: "maxDiff",
                    maxDiff: okexTopFives
                }));
            }
        } catch (error) {
            console.error('Error in priceComp:', error);
        }
    }, 10000);
}

export { intervalFunc, eventEmmiter };