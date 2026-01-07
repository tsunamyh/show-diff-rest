import WebSocket from 'ws';
import binance_wallex_common_symbols from '../../../commonSymbols/wallex_binance_common_symbols';

/**
 * Multi-connection WebSocket manager for Wallex USDT pairs
 * Splits 153 USDT pairs into batches of 15, each with its own WebSocket connection
 */

interface BatchConnection {
  id: number;
  symbols: string[];
  ws: WebSocket | null;
  isConnected: boolean;
  subscribedCount: number;
}

const BATCH_SIZE = 15;
const WALLEX_WS_URL = 'wss://api.wallex.ir/ws';

let usdtPairsData: { [pair: string]: { bid: string[]; ask: string[] } } = {};
let connections: BatchConnection[] = [];

// Split array into batches
function splitIntoBatches<T>(array: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

// Initialize batch connections
function initializeBatches(): void {
  const commonSymbols = binance_wallex_common_symbols?.symbols?.wallex_symbol as any || {};
  const allUsdtPairs = Object.keys(commonSymbols?.usdtPairs || {});
  const batches = splitIntoBatches(allUsdtPairs, BATCH_SIZE);

  console.log(`\n[USDT Batch Manager] Total USDT pairs: ${allUsdtPairs.length}`);
  console.log(`[USDT Batch Manager] Creating ${batches.length} WebSocket connections (${BATCH_SIZE} pairs each)\n`);

  batches.forEach((batch, index) => {
    connections.push({
      id: index + 1,
      symbols: batch,
      ws: null,
      isConnected: false,
      subscribedCount: 0
    });
  });
}

// Connect a single batch
function connectBatch(batchId: number): void {
  const batch = connections[batchId];
  if (!batch) return;

  console.log(`[Batch #${batch.id}] Connecting to Wallex WebSocket... (${batch.symbols.length} symbols)`);

  const ws = new WebSocket(WALLEX_WS_URL);
  batch.ws = ws;

  ws.on('open', () => {
    console.log(`[Batch #${batch.id}] ✓ Connected`);
    batch.isConnected = true;

    // Subscribe to all symbols in this batch
    batch.symbols.forEach(symbol => {
      ws.send(JSON.stringify(['subscribe', { channel: `${symbol}@buyDepth` }]));
      ws.send(JSON.stringify(['subscribe', { channel: `${symbol}@sellDepth` }]));
      batch.subscribedCount += 2;
    });

    console.log(`[Batch #${batch.id}] ✓ Subscribed to ${batch.symbols.length} pairs (${batch.subscribedCount} channels)`);
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (Array.isArray(message) && message[0] && message[1]) {
        const channel: string = message[0];
        const orderData = message[1];

        const match = channel.match(/^([^@]+)@(buyDepth|sellDepth)$/);
        if (!match) return;

        const symbol = match[1].toUpperCase();
        const depthType = match[2];

        if (!symbol.endsWith('USDT')) return;

        const orderBook = orderData[0];
        if (!orderBook) return;

        if (!usdtPairsData[symbol]) {
          usdtPairsData[symbol] = { bid: [], ask: [] };
        }

        if (depthType === 'buyDepth') {
          usdtPairsData[symbol].ask = [
            orderBook.price?.toString() || '0',
            orderBook.quantity?.toString() || '0',
            orderBook.sum?.toString() || '0'
          ];
        } else {
          usdtPairsData[symbol].bid = [
            orderBook.price?.toString() || '0',
            orderBook.quantity?.toString() || '0',
            orderBook.sum?.toString() || '0'
          ];
        }
      }
    } catch (e) {}
  });

  ws.on('error', (error: Error) => {
    console.error(`[Batch #${batch.id}] ✗ WebSocket error:`, error.message);
  });

  ws.on('close', () => {
    console.log(`[Batch #${batch.id}] ✗ Connection closed`);
    batch.isConnected = false;
  });
}

// Connect all batches
function connectAllBatches(): void {
  connections.forEach((_, index) => {
    connectBatch(index);
  });
}

// Get USDT pairs data
function getUsdtPairsData(): { [pair: string]: { bid: string[]; ask: string[] } } {
  return { ...usdtPairsData };
}

// Get connection status
function getStatus(): void {
  console.log('\n========== USDT Batch Manager Status ==========');
  console.log(`Total batches: ${connections.length}`);
  
  connections.forEach(batch => {
    const status = batch.isConnected ? '✓' : '✗';
    const received = Object.keys(usdtPairsData).filter(s => 
      batch.symbols.includes(s)
    ).length;
    
    console.log(`${status} Batch #${batch.id}: ${received}/${batch.symbols.length} pairs receiving data`);
  });
  
  const totalReceived = Object.keys(usdtPairsData).length;
  console.log(`\nTotal USDT pairs receiving data: ${totalReceived}/153 (${((totalReceived / 153) * 100).toFixed(2)}%)`);
  console.log('==========================================\n');
}

export {
  initializeBatches,
  connectAllBatches,
  getUsdtPairsData,
  getStatus
};
