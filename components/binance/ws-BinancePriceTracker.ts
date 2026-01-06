import WebSocket from 'ws';
import { EventEmitter } from 'stream';
import binance_wallex_common_symbols from '../../commonSymbols/wallex_binance_common_symbols';
import { getUsdtToTmnRate } from '../exchanges/wsTracker/ws-WallexPriceTracker';

// Types
interface BookTicker {
  u: number;        // updateId
  s: string;        // symbol
  b: string;        // best bid price
  B: string;        // best bid qty
  a: string;        // best ask price
  A: string;        // best ask qty
}

interface BinancePriceData {
  usdt: { [symbol: string]: {
    bid: [string, string];  // [USDT price, TMN price]
    ask: [string, string];  // [USDT price, TMN price]
  }};
}

// interface BinancePriceData {
//   [symbol: string]: {
//     bid: [string, string];  // [USDT price, TMN price]
//     ask: [string, string];  // [USDT price, TMN price]
//   };
// }
// Global state
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000; // 3 seconds
const BINANCE_WS_URL = 'wss://data-stream.binance.vision/ws';

// Store latest prices
let binanceOrderBooks: BinancePriceData = {"usdt": {}};

// Event emitter for price updates
const priceUpdateEmitter = new EventEmitter();
priceUpdateEmitter.setMaxListeners(10);

// Get symbols from common symbols
function getSymbolsToSubscribe(): string[] {
  try {
    const symbols = binance_wallex_common_symbols?.symbols?.binance_symbol || [];
    return symbols.map(s => s.toLowerCase() + '@bookTicker');
  } catch (error) {
    console.error('[Binance WS] Failed to get symbols:', error);
    return [];
  }
}

// Parse bookTicker message and update prices
function handleBookTicker(message: BookTicker): void {
  const { s: symbol, b: bidPrice, a: askPrice } = message;
  
  if (!symbol || !bidPrice || !askPrice) {
    console.warn('[Binance WS] Invalid bookTicker message:', message);
    return;
  }

  const bid = parseFloat(bidPrice);
  const ask = parseFloat(askPrice);

  if (bid === 0 || ask === 0 || isNaN(bid) || isNaN(ask)) {
    return;
  }

  // Store in memory - use latest rate from rate tracker
  const rate = getUsdtToTmnRate();
  const bidTmn = (bid * rate).toString();
  const askTmn = (ask * rate).toString();

  binanceOrderBooks[symbol.toUpperCase()] = {
    bid: [bidPrice, bidTmn],
    ask: [askPrice, askTmn]
  };

  // Emit update event
  priceUpdateEmitter.emit('priceUpdate', { symbol: symbol.toUpperCase() });
}

// Connect to Binance WebSocket
function connect(): void {
  try {
    console.log('[Binance WS] Connecting to Binance WebSocket...');
    console.log('[Binance WS] URL:', BINANCE_WS_URL);

    ws = new WebSocket(BINANCE_WS_URL);
    console.log('[Binance WS] WebSocket object created');

    ws.on('open', () => {
      console.log('[Binance WS] Connected successfully');
      reconnectAttempts = 0;
      
      // Subscribe to all symbols
      const symbolsToSubscribe = getSymbolsToSubscribe(); // e.g., btcusdt@bookTicker
      if (symbolsToSubscribe.length === 0) {
        console.warn('[Binance WS] No symbols to subscribe to');
        return;
      }

      const subscribeMessage = {
        method: 'SUBSCRIBE',
        params: symbolsToSubscribe,
        id: Date.now()
      };

      console.log(`[Binance WS] Subscribing to ${symbolsToSubscribe.length} symbols...`);
      ws!.send(JSON.stringify(subscribeMessage));
      
      // Emit ready event
      priceUpdateEmitter.emit('ready');
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle subscription response
        if (message.result === null && message.id) {
          console.log('[Binance WS] Subscription confirmed');
          return;
        }

        // Handle bookTicker updates
        if (message.u && message.s && message.b && message.a) {
          handleBookTicker(message as BookTicker);
        }
      } catch (error) {
        console.error('[Binance WS] Error parsing message:', error);
      }
    });

    ws.on('error', (error: Error) => {
      console.error('[Binance WS] WebSocket error:', error.message);
      priceUpdateEmitter.emit('error', error);
    });

    ws.on('close', () => {
      console.log('[Binance WS] Connection closed');
      priceUpdateEmitter.emit('disconnected');
      attemptReconnect();
    });

  } catch (error) {
    console.error('[Binance WS] Failed to create WebSocket:', error);
    attemptReconnect();
  }
}

// Attempt to reconnect with exponential backoff
function attemptReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Binance WS] Max reconnection attempts reached');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
  console.log(`[Binance WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  setTimeout(() => {
    connect();
  }, delay);
}

// Close WebSocket connection
function disconnect(): void {
  if (ws) {
    ws.close();
    ws = null;
  }
  reconnectAttempts = 0;
}

// Get latest binance orderbooks
function getBinanceOrderBooks(): BinancePriceData {
  return { ...binanceOrderBooks };
}

// Get price for specific symbol
function getSymbolPrice(symbol: string): { bid: [string, string]; ask: [string, string] } | null {
  const upperSymbol = symbol.toUpperCase();
  return binanceOrderBooks[upperSymbol] || null;
}

// Get connection status
function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

// Get ready event subscription
function onReady(callback: () => void): void {
  priceUpdateEmitter.once('ready', callback);
}

// Get price update event subscription
function onPriceUpdate(callback: (data: { symbol: string }) => void): void {
  priceUpdateEmitter.on('priceUpdate', callback);
}

// Remove price update listener
function offPriceUpdate(callback: (data: { symbol: string }) => void): void {
  priceUpdateEmitter.off('priceUpdate', callback);
}

// Test function
async function testBinanceWebSocket(): Promise<void> {
  console.log('\n========== BINANCE WEBSOCKET TEST ==========\n');
  console.log('[TEST] Starting test...');
  
  // Call connect explicitly
  console.log('[TEST] Calling connect()...');
  connect();
  
  let updateCount = 0;
  let connectedFlag = false;

  // Setup connection event listeners
  priceUpdateEmitter.on('ready', () => {
    connectedFlag = true;
    console.log('[TEST] ✓ WebSocket ready and subscribed to symbols');
  });

  priceUpdateEmitter.on('error', (error) => {
    console.error('[TEST] WebSocket error:', error.message);
  });

  priceUpdateEmitter.on('disconnected', () => {
    console.log('[TEST] WebSocket disconnected');
  });

  // Setup price update listener
  const priceListener = (data: { symbol: string }) => {
    updateCount++;
    const prices = getSymbolPrice(data.symbol);
    console.log(`[UPDATE #${updateCount}] ${data.symbol}: BID=${prices?.bid[0]} ASK=${prices?.ask[0]}`);
  };

  onPriceUpdate(priceListener);

  // Test timeout - run for 20 seconds
  await new Promise<void>((resolve) => {
    const testTimeout = setTimeout(() => {
      console.log('\n========== TEST SUMMARY ==========');
      console.log(`Connected: ${connectedFlag}`);
      console.log(`Total price updates received: ${updateCount}`);
      const allPrices = getBinanceOrderBooks();
      const symbolCount = Object.keys(allPrices).filter(k => k !== 'usdt').length;
      console.log(`Total symbols cached: ${symbolCount}`);
      
      if (symbolCount > 0) {
        const samples = Object.entries(allPrices).filter(([k]) => k !== 'usdt').slice(0, 5);
        console.log('\nSample prices:');
        samples.forEach(([symbol, prices]) => {
          if (prices && prices.bid && prices.ask) {
            console.log(`  ${symbol}: BID=${prices.bid[0]} (${prices.bid[1]} TMN) ASK=${prices.ask[0]} (${prices.ask[1]} TMN)`);
          }
        });
      }

      console.log('\n[TEST] Disconnecting...\n');
      offPriceUpdate(priceListener);
      disconnect();
      resolve();
    }, 20000);
  });
}

// Initialize WebSocket on import (only if not in test mode)

  testBinanceWebSocket().catch(console.error);


export {
  connect,
  disconnect,
  isConnected,
  getBinanceOrderBooks as getBinancePrices,
  getSymbolPrice,
  onReady,
  onPriceUpdate,
  offPriceUpdate,
  priceUpdateEmitter,
  testBinanceWebSocket
};
