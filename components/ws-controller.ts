import { 
  connect as connectWallex,
  getWallexOrderbooks,
  getUsdtToTmnRate,
  disconnect as disconnectWallex,
  priceUpdateEmitter,
  WallexTmnPairIndex,
  WallexUsdtPairIndex,
  onPriceUpdate
} from './exchanges/wsTracker/ws-WallexPriceTracker';
import {
  connect as connectBinance,
  getBinancePrices,
  disconnect as disconnectBinance
} from './binance/ws-BinancePriceTracker';
import test from 'node:test';



// async function testWallexWebSocket(): Promise<void> {
//   console.log('\n========== WALLEX WEBSOCKET TEST ==========\n');

  connectWallex();
  
//   let updateCount = 0;
//   let connectedFlag = false;

//   // Setup connection event listeners
//   priceUpdateEmitter.on('ready', () => {
//     connectedFlag = true;
//     console.log('[TEST] ✓ WebSocket ready and subscribed to symbols');
//   });

//   priceUpdateEmitter.on('error', (error) => {
//     console.error('[TEST] WebSocket error:', error.message);
//   });

//   priceUpdateEmitter.on('disconnected', () => {
//     console.log('[TEST] WebSocket disconnected');
//   });

//   // Setup price update listener
  const priceListener = (data: { symbol: string }) => {
    // updateCount++;
    const orderbooks = getWallexOrderbooks();
    const tmnData = orderbooks.tmnPairs[data.symbol];
    const usdtData = orderbooks.usdtPairs[data.symbol];
    if(data.symbol == "METTMN"){
      console.log(data.symbol,tmnData);
    }
    if(data.symbol.endsWith("USDT")){
      console.log(data.symbol,usdtData);
    }  
    // console.log(data.symbol,"tmndata:"/* ,tmnData */,"usdtdataaaaaaaaaaaaaaaaaa:",usdtData,getUsdtToTmnRate());
    
    if (tmnData && (tmnData.bid.length > 0 || tmnData.ask.length > 0)) {
      const bidPrice = tmnData.bid[WallexTmnPairIndex.PRICE] || '0';
      const askPrice = tmnData.ask[WallexTmnPairIndex.PRICE] || '0';
      // console.log(`[UPDATE wallex #${updateCount}] ${data.symbol} (TMN): BID=${bidPrice} ASK=${askPrice}`);
    } else if (usdtData && (usdtData.bid.length > 0 || usdtData.ask.length > 0)) {
      const bidTmnPrice = usdtData.bid[WallexUsdtPairIndex.TMN_PRICE] || '0';
      const bidVolume = usdtData.bid[WallexUsdtPairIndex.VOLUME_CURRENCY] || '0';
      const bidUsdtPrice = usdtData.bid[WallexUsdtPairIndex.USDT_PRICE] || '0';
      const askTmnPrice = usdtData.ask[WallexUsdtPairIndex.TMN_PRICE] || '0';
      const askVolume = usdtData.ask[WallexUsdtPairIndex.VOLUME_CURRENCY] || '0';
      const askUsdtPrice = usdtData.ask[WallexUsdtPairIndex.USDT_PRICE] || '0';
      // console.log(`[UPDATE #${updateCount}] ${data.symbol} (USDT): BID=[${bidTmnPrice},${bidVolume},${bidUsdtPrice}] ASK=[${askTmnPrice},${askVolume},${askUsdtPrice}]`);
    }
  };

  onPriceUpdate(priceListener);

//   // Test timeout - run for 25 seconds
//   // await new Promise<void>((resolve) => {
//   //   const testTimeout = setTimeout(() => {
//   //     const orderbooks = getWallexOrderbooks();
      
//   //     console.log('\n========== TEST SUMMARY ==========');
//   //     console.log(`Connected: ${connectedFlag}`);
//   //     console.log(`Total price updates received: ${updateCount}`);
//   //     console.log(`TMN pairs cached: ${Object.keys(orderbooks.tmnPairs).length}`);
//   //     console.log(`USDT pairs cached: ${Object.keys(orderbooks.usdtPairs).length}`);
      
//   //     if (Object.keys(orderbooks.tmnPairs).length > 0) {
//   //       const tmnSamples = Object.entries(orderbooks.tmnPairs).slice(0, 3);
//   //       console.log('\nSample TMN pairs:');
//   //       tmnSamples.forEach(([symbol, data]) => {
//   //         const bidPrice = data.bid[0] || '-';
//   //         const askPrice = data.ask[0] || '-';
//   //         console.log(`  ${symbol}: BID=${bidPrice} ASK=${askPrice}`);
//   //       });
//   //     }

//   //     if (Object.keys(orderbooks.usdtPairs).length > 0) {
//   //       const usdtSamples = Object.entries(orderbooks.usdtPairs).slice(0, 3);
//   //       console.log('\nSample USDT pairs:');
//   //       usdtSamples.forEach(([symbol, data]) => {
//   //         const bidTmnPrice = data.bid[WallexUsdtPairIndex.TMN_PRICE] || '-';
//   //         const bidVolume = data.bid[WallexUsdtPairIndex.VOLUME_CURRENCY] || '-';
//   //         const bidUsdtPrice = data.bid[WallexUsdtPairIndex.USDT_PRICE] || '-';
//   //         const askTmnPrice = data.ask[WallexUsdtPairIndex.TMN_PRICE] || '-';
//   //         const askVolume = data.ask[WallexUsdtPairIndex.VOLUME_CURRENCY] || '-';
//   //         const askUsdtPrice = data.ask[WallexUsdtPairIndex.USDT_PRICE] || '-';
//   //         console.log(`  ${symbol} BID: [${bidTmnPrice}, ${bidVolume}, ${bidUsdtPrice}]`);
//   //         console.log(`  ${symbol} ASK: [${askTmnPrice}, ${askVolume}, ${askUsdtPrice}]`);
//   //       });
//   //     }

//   //     console.log('\n[TEST] Disconnecting...\n');
//   //     offPriceUpdate(priceListener);
//   //     disconnect();
//   //     resolve();
//   //   }, 25000);
//   // });
// }
// testWallexWebSocket().catch(console.error);


// async function testOrderBooks(): Promise<void> {
//   console.log('\n========== ORDER BOOKS TEST ==========\n');

//   // Connect to both
//   console.log('[TEST] Connecting to Wallex...');
//   connectWallex();
  
//   await new Promise(resolve => setTimeout(resolve, 2500));
  
//   console.log('[TEST] Connecting to Binance...');
//   connectBinance();
  
//   await new Promise(resolve => setTimeout(resolve, 3000));

//   // Run logs every 2 seconds for 14 seconds
//   let iteration = 0;
//   const maxIterations = 7;

//   const testInterval = setInterval(() => {
//     iteration++;
//     console.log(`\n========== LOG #${iteration} ==========`);

//     // Wallex data (check USDT pairs first since that's the issue)
//     const wallexBooks = getWallexOrderbooks();
//     const tmnSymbols = Object.keys(wallexBooks.tmnPairs);
//     const usdtSymbols = Object.keys(wallexBooks.usdtPairs);

//     console.log(`\n[Wallex] TMN pairs: ${tmnSymbols.length}`);
//     if (tmnSymbols.length > 0) {
//       const samples = tmnSymbols.slice(0, 3);
//       samples.forEach(symbol => {
//         const data = wallexBooks.tmnPairs[symbol];
//         const bid = data.bid[0] || '-';
//         const ask = data.ask[0] || '-';
//         console.log(`  ${symbol}: BID=${bid} | ASK=${ask}`);
//       });
//     }

//     console.log(`\n[Wallex] USDT pairs: ${usdtSymbols.length}`);
//     if (usdtSymbols.length > 0) {
//       const samples = usdtSymbols.slice(0, 5);
//       samples.forEach(symbol => {
//         const data = wallexBooks.usdtPairs[symbol];
//         const bidTmn = data.bid[0] || '-';
//         const bidUsdt = data.bid[2] || '-';
//         console.log(`  ${symbol}: BID_TMN=${bidTmn} | BID_USDT=${bidUsdt}`);
//       });
//     } else {
//       console.log('  ⚠️  NO USDT PAIRS RECEIVED!');
//     }

//     // Rate
//     const rate = getUsdtToTmnRate();
//     console.log(`\n[Wallex] USDT→TMN Rate: ${rate}`);

//     // Binance data
//     const binancePricesData = getBinancePrices();
//     const binanceSymbols = Object.keys(binancePricesData.usdt || {});
//     console.log(`\n[Binance] Total symbols: ${binanceSymbols.length}`);
//     if (binanceSymbols.length > 0) {
//       const samples = binanceSymbols.slice(0, 3);
//       samples.forEach(symbol => {
//         const price = binancePricesData.usdt[symbol];
//         if (price) {
//           console.log(`  ${symbol}: BID=${price.bid[0]} | ASK=${price.ask[0]}`);
//         }
//       });
//     }

//     if (iteration >= maxIterations) {
//       clearInterval(testInterval);
//       console.log('\n========== TEST COMPLETE ==========\n');
//       disconnectWallex();
//       disconnectBinance();
//       process.exit(0);
//     }
//   }, 2000);
// }

// testOrderBooks().catch(console.error);
