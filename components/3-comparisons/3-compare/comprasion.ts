import { EventEmitter } from "stream";
import { getAllexchangesOrderBooks } from "../../2-controller/controller";
import { BinanceOrderbooks, OkexOrderbooks, WallexOrderbooks, NobitexOrderbooks } from "../../types/types";
import { wallex_priceComp, initializeTrackerWithHistory as initWallexHistory } from "../2-exchanges-vs-binance/wallex-binance";
import { okex_priceComp, initializeTrackerWithHistory as initOkexHistory } from "../2-exchanges-vs-binance/okex-binance";
import { nobitex_priceComp, initializeTrackerWithHistory as initNobitexHistory } from "../2-exchanges-vs-binance/nobitex-binance";
import { getDataByPeriod } from "../../utils/historyManager";

const eventEmmiter = new EventEmitter();
eventEmmiter.setMaxListeners(9);

// Initialize history on startup
initOkexHistory();
initNobitexHistory();

async function intervalFunc(): Promise<NodeJS.Timeout> {
  initWallexHistory();
  return setInterval(async function () {
    try {
      const [binanceOrderbooksPromise, exchangesOrderbooksPromise] = await getAllexchangesOrderBooks();
      let binanceOrderbooks: BinanceOrderbooks;
      let wallexOrderbooks: WallexOrderbooks;
      let okexOrderbooks: OkexOrderbooks;
      let nobitexOrderbooks: NobitexOrderbooks;

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
        nobitexOrderbooks = exchangesOrderbooksPromise.value.nobitexOrderbooks;
        const nobitexTopRowsInfo = await nobitex_priceComp(binanceOrderbooks, nobitexOrderbooks);

        const combinedTopRowsInfo = [...wallexTopRowsInfo, ...okexTopRowsInfo, ...nobitexTopRowsInfo];
        combinedTopRowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent)
        const combinedTopRowsInfo10 = combinedTopRowsInfo.slice(0, 22);

        eventEmmiter.emit("diff", JSON.stringify(combinedTopRowsInfo10));
        const wallexTopFives = getDataByPeriod('wallex');
        eventEmmiter.emit("diff", JSON.stringify({
          status: "maxDiff",
          maxDiff: wallexTopFives
        }));
        const okexTopFives = getDataByPeriod('okex');
        eventEmmiter.emit("diff", JSON.stringify({
          status: "maxDiff",
          maxDiff: okexTopFives
        }));
        const nobitexTopFives = getDataByPeriod('nobitex');
        eventEmmiter.emit("diff", JSON.stringify({
          status: "maxDiff",
          maxDiff: nobitexTopFives
        }));
      }
    } catch (error) {
      console.error('Error in priceComp:', error);
    }
  }, 10000);
}

export { intervalFunc, eventEmmiter };