import WebSocket from 'ws';
import { EventEmitter } from 'stream';
import binance_wallex_common_symbols from '../../commonSymbols/wallex_binance_common_symbols';

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
  [symbol: string]: {
    bid: [string, string];  // [USDT price, TMN price]
    ask: [string, string];  // [USDT price, TMN price]
  };
}

// Global state
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000; // 3 seconds
const BINANCE_WS_URL = 'wss://data-stream.binance.vision/ws';

// Store latest prices
let binancePrices: BinancePriceData = {};
let usdtToTmnRate = 1;

// Event emitter for price updates
const priceUpdateEmitter = new EventEmitter();
priceUpdateEmitter.setMaxListeners(10);

// Get symbols from common symbols
function getSymbolsToSubscribe(): string[] {
  try {
    const symbols = binance_wallex_common_symbols?.symbols?.binance_symbol || [];
    return symbols.filter(s => s.endsWith('USDT')).map(s => s.toLowerCase() + '@bookTicker');
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

  // Store in memory
  const bidTmn = (bid * usdtToTmnRate).toString();
  const askTmn = (ask * usdtToTmnRate).toString();

  binancePrices[symbol.toUpperCase()] = {
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

    ws = new WebSocket(BINANCE_WS_URL);

    ws.on('open', () => {
      console.log('[Binance WS] Connected successfully');
      reconnectAttempts = 0;
      
      // Subscribe to all symbols
      const symbols = getSymbolsToSubscribe();
      if (symbols.length === 0) {
        console.warn('[Binance WS] No symbols to subscribe to');
        return;
      }

      const subscribeMessage = {
        method: 'SUBSCRIBE',
        params: symbols,
        id: Date.now()
      };

      console.log(`[Binance WS] Subscribing to ${symbols.length} symbols...`);
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

// Get latest binance prices
function getBinancePrices(): BinancePriceData {
  return { ...binancePrices };
}

// Get price for specific symbol
function getSymbolPrice(symbol: string): { bid: [string, string]; ask: [string, string] } | null {
  const upperSymbol = symbol.toUpperCase();
  return binancePrices[upperSymbol] || null;
}

// Update USDT to TMN rate (called from wallexPriceTracker)
function setUsdtToTmnRate(rate: number): void {
  if (rate > 0 && !isNaN(rate)) {
    const oldRate = usdtToTmnRate;
    usdtToTmnRate = rate;

    // Recalculate all TMN prices with new rate
    Object.keys(binancePrices).forEach(symbol => {
      const bid = parseFloat(binancePrices[symbol].bid[0]);
      const ask = parseFloat(binancePrices[symbol].ask[0]);

      if (bid > 0 && ask > 0) {
        binancePrices[symbol].bid[1] = (bid * rate).toString();
        binancePrices[symbol].ask[1] = (ask * rate).toString();
      }
    });

    if (oldRate !== rate) {
      console.log(`[Binance WS] USDT rate updated: ${oldRate} -> ${rate}`);
    }
  }
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

// Initialize WebSocket on import
connect();

export {
  connect,
  disconnect,
  isConnected,
  getBinancePrices,
  getSymbolPrice,
  setUsdtToTmnRate,
  onReady,
  onPriceUpdate,
  offPriceUpdate,
  priceUpdateEmitter
};
