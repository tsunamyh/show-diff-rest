import { 
  connect as connectWallex,
  getWallexOrderbooks,
  getUsdtToTmnRate,
  disconnect as disconnectWallex
} from './exchanges/wsTracker/ws-WallexPriceTracker';
import {
  connect as connectBinance,
  getBinancePrices,
  disconnect as disconnectBinance
} from './binance/ws-BinancePriceTracker';

async function testOrderBooks(): Promise<void> {
  console.log('\n========== ORDER BOOKS TEST ==========\n');

  // Connect to both
  console.log('[TEST] Connecting to Wallex...');
  connectWallex();
  
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  console.log('[TEST] Connecting to Binance...');
  connectBinance();
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Run logs every 2 seconds for 14 seconds
  let iteration = 0;
  const maxIterations = 7;

  const testInterval = setInterval(() => {
    iteration++;
    console.log(`\n========== LOG #${iteration} ==========`);

    // Wallex data (check USDT pairs first since that's the issue)
    const wallexBooks = getWallexOrderbooks();
    const tmnSymbols = Object.keys(wallexBooks.tmnPairs);
    const usdtSymbols = Object.keys(wallexBooks.usdtPairs);

    console.log(`\n[Wallex] TMN pairs: ${tmnSymbols.length}`);
    if (tmnSymbols.length > 0) {
      const samples = tmnSymbols.slice(0, 3);
      samples.forEach(symbol => {
        const data = wallexBooks.tmnPairs[symbol];
        const bid = data.bid[0] || '-';
        const ask = data.ask[0] || '-';
        console.log(`  ${symbol}: BID=${bid} | ASK=${ask}`);
      });
    }

    console.log(`\n[Wallex] USDT pairs: ${usdtSymbols.length}`);
    if (usdtSymbols.length > 0) {
      const samples = usdtSymbols.slice(0, 5);
      samples.forEach(symbol => {
        const data = wallexBooks.usdtPairs[symbol];
        const bidTmn = data.bid[0] || '-';
        const bidUsdt = data.bid[2] || '-';
        console.log(`  ${symbol}: BID_TMN=${bidTmn} | BID_USDT=${bidUsdt}`);
      });
    } else {
      console.log('  ⚠️  NO USDT PAIRS RECEIVED!');
    }

    // Rate
    const rate = getUsdtToTmnRate();
    console.log(`\n[Wallex] USDT→TMN Rate: ${rate}`);

    // Binance data
    const binancePricesData = getBinancePrices();
    const binanceSymbols = Object.keys(binancePricesData.usdt || {});
    console.log(`\n[Binance] Total symbols: ${binanceSymbols.length}`);
    if (binanceSymbols.length > 0) {
      const samples = binanceSymbols.slice(0, 3);
      samples.forEach(symbol => {
        const price = binancePricesData.usdt[symbol];
        if (price) {
          console.log(`  ${symbol}: BID=${price.bid[0]} | ASK=${price.ask[0]}`);
        }
      });
    }

    if (iteration >= maxIterations) {
      clearInterval(testInterval);
      console.log('\n========== TEST COMPLETE ==========\n');
      disconnectWallex();
      disconnectBinance();
      process.exit(0);
    }
  }, 2000);
}

testOrderBooks().catch(console.error);
