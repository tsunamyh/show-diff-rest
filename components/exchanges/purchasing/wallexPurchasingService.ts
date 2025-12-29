import axios, { AxiosResponse } from "axios";
import crypto from "crypto";

const baseUrl = "https://api.wallex.ir/v1/account/";

// Create axios instance with base configuration
const wallexClient = axios.create({
  baseURL: baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.WALLEX_X_API_Key || ''
  }
});

// ==================== Types ====================

export interface PlaceOrderRequest {
  symbol: string;
  type: 'LIMIT' | 'MARKET';
  side: 'BUY' | 'SELL';
  price?: number | string;
  quantity: number;
  client_id?: string; // Optional, auto-generated if not provided
}

export interface OrderFill {
  price: string;
  qty: string;
  commission: string;
}

export interface OrderResponse {
  result: {
    symbol: string;
    type: 'LIMIT' | 'MARKET';
    side: 'BUY' | 'SELL';
    clientOrderId: string;
    price: string;
    origQty: string;
    origSum: string;
    executedSum: string;
    executedQty: string;
    executedPrice: string;
    sum: string;
    fee: string;
    executedPercent: number;
    status: string;
    active: boolean;
    fills: OrderFill[];
    transactTime: number;
    created_at: string;
    updated_at: string;
  };
  message: string;
  success: boolean;
}

// ==================== Functions ====================

/**
 * Generate a unique client_id with timestamp
 * Format: timestamp-randomstring
 */
function generateClientId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Place a buy or sell order on Wallex
 * @param orderData - Order details {symbol, type, side, price, quantity, client_id}
 * @returns Order response with order ID and status
 */
export async function placeOrder(orderData: PlaceOrderRequest): Promise<OrderResponse> {
  try {
    // Validate required fields
    if (!orderData.symbol || !orderData.type || !orderData.side || !orderData.quantity) {
      throw new Error('Missing required fields: symbol, type, side, quantity');
    }

    // For LIMIT orders, price is required
    if (orderData.type === 'LIMIT' && !orderData.price) {
      throw new Error('Price is required for LIMIT orders');
    }

    // Build request body
    const requestBody: any = {
      symbol: orderData.symbol,
      type: orderData.type,
      side: orderData.side,
      quantity: orderData.quantity,
      client_id: orderData.client_id || generateClientId() // Generate if not provided
    };

    // Add price for LIMIT orders
    if (orderData.type === 'LIMIT') {
      requestBody.price = orderData.price;
    }

    console.log(`Placing ${orderData.side} order for ${orderData.symbol}:`, requestBody);

    // Make POST request to Wallex
    const response = await wallexClient.post<OrderResponse>('/orders', requestBody);

    console.log(`Order placed successfully. Order ID: ${response.data.result?.clientOrderId}`);

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Failed to place order';
    console.error('Error placing order:', errorMessage);
    
    throw {
      success: false,
      message: errorMessage,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Place a BUY order
 */
export async function buyOrder(
  symbol: string,
  quantity: number,
  price: number,
  type: 'LIMIT' | 'MARKET' = 'LIMIT',
  client_id?: string
): Promise<OrderResponse> {
  return placeOrder({
    symbol,
    type,
    side: 'BUY',
    price,
    quantity,
    client_id
  });
}

/**
 * Place a SELL order
 */
export async function sellOrder(
  symbol: string,
  quantity: number,
  price: number,
  type: 'LIMIT' | 'MARKET' = 'LIMIT',
  client_id?: string
): Promise<OrderResponse> {
  return placeOrder({
    symbol,
    type,
    side: 'SELL',
    price,
    quantity,
    client_id
  });
}
