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
let startBalance = "0";
export async function wallexGetBalances(baseAsset: string): Promise<string> {
  const balanceResponse = await wallexService.getBalances(baseAsset);
  if (baseAsset = 'TMN') startBalance = balanceResponse;
  return balanceResponse;
}

wallexGetBalances('TMN')
  .then((balance) => {
    console.log(`Available balance for TMN: ${balance}`);
  }).catch((e) => {
    console.log("balance Avaliyeh gerefte Nashod");

  })
export function getStartBallance() {
  return startBalance;
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