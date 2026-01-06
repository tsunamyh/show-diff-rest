import * as binanceTracker from '../binance/ws-BinancePriceTracker';
import * as wallexTracker from '../exchanges/wsTracker/ws-WallexPriceTracker';

function testOrderBooks(): void {
  console.log('[Test] Starting order book retrieval...\n');

  // Log order books every 2 seconds for 14 seconds
  let count = 0;
  const interval = setInterval(() => {
    count++;
    console.log(`\n========== Log #${count} ==========`);
    
    // Get Binance prices
    const binancePrices = binanceTracker.getBinancePrices();
    console.log('[Binance] Total symbols:', Object.keys(binancePrices).length);
    
    // Log first 5 symbols from Binance
    const binanceSymbols = Object.entries(binancePrices).slice(0, 5);
    console.log('[Binance] Sample:');
    binanceSymbols.forEach(([symbol, prices]: [string, any]) => {
      if (prices && prices.bid && prices.ask) {
        console.log(`  ${symbol}: BID=${prices.bid[0]} (${prices.bid[1]} TMN) | ASK=${prices.ask[0]} (${prices.ask[1]} TMN)`);
      }
    });

    // Get Wallex order books
    const wallexBooks = wallexTracker.getWallexOrderbooks();
    console.log('[Wallex] TMN pairs:', Object.keys(wallexBooks.tmnPairs).length);
    console.log('[Wallex] USDT pairs:', Object.keys(wallexBooks.usdtPairs).length);

    // Log USDTTMN rate
    const rate = wallexTracker.getUsdtToTmnRate();
    console.log('[Wallex] USDTTMN Rate:', rate);

    // Log first 3 TMN pairs
    const tmnSymbols = Object.entries(wallexBooks.tmnPairs).slice(0, 3);
    console.log('[Wallex] TMN Sample:');
    tmnSymbols.forEach(([symbol, data]: [string, any]) => {
      console.log(`  ${symbol}: BID=[${data.bid}] | ASK=[${data.ask}]`);
    });

    // Log first 3 USDT pairs
    const usdtSymbols = Object.entries(wallexBooks.usdtPairs).slice(0, 3);
    console.log('[Wallex] USDT Sample:');
    usdtSymbols.forEach(([symbol, data]: [string, any]) => {
      console.log(`  ${symbol}: BID=[${data.bid}] | ASK=[${data.ask}]`);
    });

    if (count >= 7) {
      clearInterval(interval);
      console.log('\n[Test] Test complete');
      process.exit(0);
    }
  }, 2000);
}

testOrderBooks();
