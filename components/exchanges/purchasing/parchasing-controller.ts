import { WallexPurchasingService, PlaceOrderRequest, OrderResponse, OpenOrdersResponse, BalancesResponse } from "./wallexPurchasingService";

// ==================== Service Instances ====================

const wallexService = new WallexPurchasingService();

// ==================== Wallex Functions ====================

/**
 * Place a buy or sell order on Wallex
 */
export async function wallexPlaceOrder(orderData: PlaceOrderRequest): Promise<OrderResponse> {
  return await wallexService.placeOrder(orderData);
}

/**
 * Place a buy order on Wallex
 */
export async function wallexBuyOrder(
  symbol: string,
  quantity: number,
  price: number,
  type: 'LIMIT' | 'MARKET' = 'LIMIT',
  client_id?: string
): Promise<OrderResponse> {
  return await wallexService.buyOrder(symbol, quantity, price, type, client_id);
}

/**
 * Place a sell order on Wallex
 */
export async function wallexSellOrder(
  symbol: string,
  quantity: number,
  price: number,
  type: 'LIMIT' | 'MARKET' = 'LIMIT',
  client_id?: string
): Promise<OrderResponse> {
  return await wallexService.sellOrder(symbol, quantity, price, type, client_id);
}

/**
 * Get order details from Wallex
 */
export async function wallexGetOrder(clientOrderId: string): Promise<OrderResponse> {
  return await wallexService.getOrder(clientOrderId);
}

/**
 * Cancel an order on Wallex
 */
export async function wallexCancelOrderById(clientOrderId: string): Promise<{
  success: boolean;
  message: string;
  result?: any;
}> {
  return await wallexService.cancelOrderById(clientOrderId);
}

/**
 * Get active orders from Wallex
 */
export async function wallexGetOpenOrders(symbol?: string): Promise<OpenOrdersResponse> {
  return await wallexService.getOpenOrders(symbol);
}

/**
 * Get wallet balances from Wallex
 */
export async function wallexGetBalances(baseAsset: string): Promise<string> {
  return await wallexService.getBalances(baseAsset);
}

// ==================== OKEX Functions (Placeholder) ====================

/**
 * Place a buy or sell order on OKEX
 * TODO: Implement OKEXPurchasingService
 */
// export async function okexPlaceOrder(orderData: any): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }

/**
 * Place a buy order on OKEX
 */
// export async function okexBuyOrder(
//   symbol: string,
//   quantity: number,
//   price: number,
//   type?: string
// ): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }

/**
 * Place a sell order on OKEX
 */
// export async function okexSellOrder(
//   symbol: string,
//   quantity: number,
//   price: number,
//   type?: string
// ): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }

// /**
//  * Get order details from OKEX
//  */
// export async function okexGetOrder(orderId: string): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }

// /**
//  * Cancel an order on OKEX
//  */
// export async function okexCancelOrder(orderId: string): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }

// /**
//  * Get active orders from OKEX
//  */
// export async function okexGetOpenOrders(symbol?: string): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }

// /**
//  * Get wallet balances from OKEX
//  */
// export async function okexGetBalances(asset?: string): Promise<any> {
//   throw new Error('OKEX purchasing service not yet implemented');
// }