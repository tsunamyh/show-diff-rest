import { EventEmitter } from "stream";
import { getAllexchangesOrderBooks } from "../controller";
import { BinanceOrderbooks, OkexOrderbooks, WallexOrderbooks } from "../types/types";
import { wallex_priceComp, initializeTrackerWithHistory as initWallexHistory } from "./exchanges-vs-binance/wallex-binance";
import { okex_priceComp, initializeTrackerWithHistory as initOkexHistory } from "./exchanges-vs-binance/okex-binance";
import { getDataByPeriod } from "../utils/historyManager";
import { getBinancePrices, onPriceUpdate, setUsdtToTmnRate } from "../binance/ws-BinancePriceTracker";
import { getUsdtToTmnRate } from "../exchanges/tracker/wallexPriceTracker";

const eventEmmiter = new EventEmitter();
eventEmmiter.setMaxListeners(6);

// Initialize history on startup
initWallexHistory();
initOkexHistory();

// WebSocket state
let currentBinanceOrderbooks: BinanceOrderbooks | null = null;
let currentWallexOrderbooks: WallexOrderbooks | null = null;
let currentOkexOrderbooks: OkexOrderbooks | null = null;
let wallexRefreshInterval: NodeJS.Timeout | null = null;

// Trigger price comparison when Binance WebSocket sends update
async function triggerPriceComparison(): Promise<void> {
  try {
    // Use stored orderbooks or fetch fresh if not available
    if (!currentBinanceOrderbooks || !currentWallexOrderbooks) {
      console.log('[Comparison] Initial fetch of orderbooks...');
      const [binancePromise, exchangesPromise] = await getAllexchangesOrderBooks();

      if (binancePromise.status === "fulfilled" && binancePromise.value) {
        currentBinanceOrderbooks = binancePromise.value;
      }

      if (exchangesPromise.status === "fulfilled" && exchangesPromise.value) {
        currentWallexOrderbooks = exchangesPromise.value.wallexOrderbooks;
        currentOkexOrderbooks = exchangesPromise.value.okexOrderbooks;
      }
    }

    if (!currentBinanceOrderbooks || !currentWallexOrderbooks) {
      console.warn('[Comparison] Missing orderbooks');
      return;
    }

    // Update USDT rate in WebSocket tracker
    const currentRate = getUsdtToTmnRate();
    setUsdtToTmnRate(currentRate);

    // Perform comparison
    const wallexTopRowsInfo = await wallex_priceComp(currentBinanceOrderbooks, currentWallexOrderbooks);
    const okexTopRowsInfo = await okex_priceComp(currentBinanceOrderbooks, currentOkexOrderbooks!);

    // Combine and send results
    const combinedTopRowsInfo = [...wallexTopRowsInfo, ...okexTopRowsInfo];
    combinedTopRowsInfo.sort((a, b) => b.rowData.percent - a.rowData.percent);
    const combinedTopRowsInfo10 = combinedTopRowsInfo.slice(0, 12);

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

  } catch (error) {
    console.error('[Comparison] Error in price comparison:', error);
  }
}

// Fallback: Refresh Wallex data periodically (Binance is real-time via WebSocket)
async function refreshWallexOrderbooks(): Promise<void> {
  try {
    const [, exchangesPromise] = await getAllexchangesOrderBooks();

    if (exchangesPromise.status === "fulfilled" && exchangesPromise.value) {
      currentWallexOrderbooks = exchangesPromise.value.wallexOrderbooks;
      currentOkexOrderbooks = exchangesPromise.value.okexOrderbooks;
      console.log('[Comparison] Wallex/Okex orderbooks refreshed');
    }
  } catch (error) {
    console.error('[Comparison] Error refreshing Wallex orderbooks:', error);
  }
}

async function intervalFunc(): Promise<void> {
  // Setup Binance WebSocket listener for real-time updates
  onPriceUpdate(async (data: { symbol: string }) => {
    console.log(`[Comparison] Binance price update received for ${data.symbol}`);
    await triggerPriceComparison();
  });

  // Fallback: Refresh Wallex/Okex every 10 seconds (they are REST-based)
  wallexRefreshInterval = setInterval(async () => {
    await refreshWallexOrderbooks();
  }, 10000);

  // Initial comparison on startup
  await triggerPriceComparison();
}

export { intervalFunc, eventEmmiter };