import WebSocket from 'ws';
import { EventEmitter } from 'stream';
import binance_wallex_common_symbols from '../../../commonSymbols/wallex_binance_common_symbols';

// Types
interface OrderBook {
  quantity: number;
  price: number;
  sum: number;
}

interface WallexOrderbooks {
  exchangeName: string;
  tmnPairs: { [pair: string]: { bid: string[]; ask: string[] } };
  usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

// Global state
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000; // 3 seconds
const WALLEX_WS_URL = 'wss://api.wallex.ir/ws';

// Store latest prices for each symbol (store as strings for final output)
let tmnPairsData: { [pair: string]: { bid: string[]; ask: string[] } } = {};
let usdtPairsData: { [pair: string]: { bid: string[]; ask: string[] } } = {};

// Track subscription state
let subscribedSymbols = new Set<string>();
let pendingSubscriptions = new Map<string, 'tmnBid' | 'tmnAsk' | 'usdtBid' | 'usdtAsk'>();

// Event emitter for price updates
const priceUpdateEmitter = new EventEmitter();
priceUpdateEmitter.setMaxListeners(10);

// Get symbols from common symbols
function getSymbolsToSubscribe(): { tmnPairs: string[]; usdtPairs: string[] } {
  try {
    const commonSymbols = binance_wallex_common_symbols?.symbols?.wallex_symbol as any || {};
    const tmnKeys = Object.keys(commonSymbols?.tmnPairs || {});
    const usdtKeys = Object.keys(commonSymbols?.usdtPairs || {});
    
    return {
      tmnPairs: tmnKeys,
      usdtPairs: usdtKeys
    };
  } catch (error) {
    console.error('[Wallex WS] Failed to get symbols:', error);
    return { tmnPairs: [], usdtPairs: [] };
  }
}

// Subscribe to a specific depth channel
function subscribeToDepth(symbol: string, type: 'buyDepth' | 'sellDepth'): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn(`[Wallex WS] Cannot subscribe, WebSocket not connected`);
    return;
  }

  const channel = `${symbol}@${type}`;
  const message = JSON.stringify(['subscribe', { channel }]);
  
  try {
    ws.send(message);
    console.log(`[Wallex WS] Sent subscription: ${channel}`);
  } catch (error) {
    console.error(`[Wallex WS] Failed to subscribe to ${channel}:`, error);
  }
}

// Subscribe to all symbols
function subscribeToAllSymbols(): void {
  const { tmnPairs, usdtPairs } = getSymbolsToSubscribe();
  
  console.log(`[Wallex WS] Subscribing to ${tmnPairs.length} TMN pairs (bid+ask)...`);
  tmnPairs.forEach(symbol => {
    subscribeToDepth(symbol, 'buyDepth');  // Ask (seller side)
    subscribeToDepth(symbol, 'sellDepth'); // Bid (buyer side)
  });

  console.log(`[Wallex WS] Subscribing to ${usdtPairs.length} USDT pairs (bid+ask)...`);
  usdtPairs.forEach(symbol => {
    subscribeToDepth(symbol, 'buyDepth');  // Ask
    subscribeToDepth(symbol, 'sellDepth'); // Bid
  });
}

// Handle depth update message
function handleDepthUpdate(message: any): void {
  if (!Array.isArray(message) || message.length < 2) {
    return;
  }

  const channel: string = message[0];
  const data: OrderBook[] = message[1];

  if (!channel || !Array.isArray(data) || data.length === 0) {
    return;
  }

  // Parse channel name: "SYMBOL@buyDepth" or "SYMBOL@sellDepth"
  const match = channel.match(/^(.+)@(buyDepth|sellDepth)$/);
  if (!match) {
    return;
  }

  const symbol = match[1].toUpperCase();
  const depthType = match[2];

  // Determine if it's TMN or USDT pair
  const isTmn = symbol.endsWith('TMN');
  const isUsdt = symbol.endsWith('USDT');

  if (!isTmn && !isUsdt) {
    return;
  }

  // Convert OrderBook to string format [price, quantity] - similar to REST API format
  const priceArray = data.map(order => order.price.toString());
  const qtyArray = data.map(order => order.quantity.toString());

  // Store data as strings
  if (isTmn) {
    if (!tmnPairsData[symbol]) {
      tmnPairsData[symbol] = { bid: [], ask: [] };
    }
    
    if (depthType === 'buyDepth') {
      // buyDepth = Ask side (sellers)
      tmnPairsData[symbol].ask = [priceArray[0] || '0', qtyArray[0] || '0'];
    } else {
      // sellDepth = Bid side (buyers)
      tmnPairsData[symbol].bid = [priceArray[0] || '0', qtyArray[0] || '0'];
    }
  } else if (isUsdt) {
    if (!usdtPairsData[symbol]) {
      usdtPairsData[symbol] = { bid: [], ask: [] };
    }
    
    if (depthType === 'buyDepth') {
      // buyDepth = Ask side
      usdtPairsData[symbol].ask = [priceArray[0] || '0', qtyArray[0] || '0'];
    } else {
      // sellDepth = Bid side
      usdtPairsData[symbol].bid = [priceArray[0] || '0', qtyArray[0] || '0'];
    }
  }

  // Emit update event
  priceUpdateEmitter.emit('priceUpdate', { symbol });
}

// Connect to Wallex WebSocket
function connect(): void {
  try {
    console.log('[Wallex WS] Connecting to Wallex WebSocket...');
    console.log('[Wallex WS] URL:', WALLEX_WS_URL);

    ws = new WebSocket(WALLEX_WS_URL);

    ws.on('open', () => {
      console.log('[Wallex WS] Connected successfully');
      reconnectAttempts = 0;
      
      // Subscribe to all symbols
      subscribeToAllSymbols();
      
      // Emit ready event
      priceUpdateEmitter.emit('ready');
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        handleDepthUpdate(message);
      } catch (error) {
        console.error('[Wallex WS] Error parsing message:', error);
      }
    });

    ws.on('error', (error: Error) => {
      console.error('[Wallex WS] WebSocket error:', error.message);
      priceUpdateEmitter.emit('error', error);
    });

    ws.on('close', () => {
      console.log('[Wallex WS] Connection closed');
      priceUpdateEmitter.emit('disconnected');
      attemptReconnect();
    });

  } catch (error) {
    console.error('[Wallex WS] Failed to create WebSocket:', error);
    attemptReconnect();
  }
}

// Attempt to reconnect with exponential backoff
function attemptReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Wallex WS] Max reconnection attempts reached');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
  console.log(`[Wallex WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

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

// Get latest orderbooks
function getWallexOrderbooks(): WallexOrderbooks {
  return {
    exchangeName: 'wallex',
    tmnPairs: tmnPairsData,
    usdtPairs: usdtPairsData
  };
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
async function testWallexWebSocket(): Promise<void> {
  console.log('\n========== WALLEX WEBSOCKET TEST ==========\n');
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
    const orderbooks = getWallexOrderbooks();
    const tmnData = orderbooks.tmnPairs[data.symbol];
    const usdtData = orderbooks.usdtPairs[data.symbol];
    
    if (tmnData && (tmnData.bid.length > 0 || tmnData.ask.length > 0)) {
      const bidPrice = tmnData.bid[0] || '0';
      const askPrice = tmnData.ask[0] || '0';
      console.log(`[UPDATE #${updateCount}] ${data.symbol}: BID=${bidPrice} ASK=${askPrice}`);
    } else if (usdtData && (usdtData.bid.length > 0 || usdtData.ask.length > 0)) {
      const bidPrice = usdtData.bid[0] || '0';
      const askPrice = usdtData.ask[0] || '0';
      console.log(`[UPDATE #${updateCount}] ${data.symbol}: BID=${bidPrice} ASK=${askPrice}`);
    }
  };

  onPriceUpdate(priceListener);

  // Test timeout - run for 25 seconds
  await new Promise<void>((resolve) => {
    const testTimeout = setTimeout(() => {
      const orderbooks = getWallexOrderbooks();
      
      console.log('\n========== TEST SUMMARY ==========');
      console.log(`Connected: ${connectedFlag}`);
      console.log(`Total price updates received: ${updateCount}`);
      console.log(`TMN pairs cached: ${Object.keys(orderbooks.tmnPairs).length}`);
      console.log(`USDT pairs cached: ${Object.keys(orderbooks.usdtPairs).length}`);
      
      if (Object.keys(orderbooks.tmnPairs).length > 0) {
        const tmnSamples = Object.entries(orderbooks.tmnPairs).slice(0, 3);
        console.log('\nSample TMN pairs:');
        tmnSamples.forEach(([symbol, data]) => {
          const bidPrice = data.bid[0] || '-';
          const askPrice = data.ask[0] || '-';
          console.log(`  ${symbol}: BID=${bidPrice} ASK=${askPrice}`);
        });
      }

      if (Object.keys(orderbooks.usdtPairs).length > 0) {
        const usdtSamples = Object.entries(orderbooks.usdtPairs).slice(0, 3);
        console.log('\nSample USDT pairs:');
        usdtSamples.forEach(([symbol, data]) => {
          const bidPrice = data.bid[0] || '-';
          const askPrice = data.ask[0] || '-';
          console.log(`  ${symbol}: BID=${bidPrice} ASK=${askPrice}`);
        });
      }

      console.log('\n[TEST] Disconnecting...\n');
      offPriceUpdate(priceListener);
      disconnect();
      resolve();
    }, 25000);
  });
}

// Initialize WebSocket on import (only if in test mode)
if (process.argv[1]?.includes('ws-WallexPriceTracker')) {
  console.log('[Wallex WS] Test mode detected, calling testWallexWebSocket...');
  testWallexWebSocket().catch(console.error);
} else {
  console.log('[Wallex WS] Production mode, connecting to WebSocket...');
  connect();
}

export {
  connect,
  disconnect,
  isConnected,
  getWallexOrderbooks,
  onReady,
  onPriceUpdate,
  offPriceUpdate,
  priceUpdateEmitter,
  testWallexWebSocket
};
