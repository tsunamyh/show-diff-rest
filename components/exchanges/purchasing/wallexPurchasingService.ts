import axios from "axios";

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
  success: boolean;
  message: string;
  result: {
    symbol: string;
    type: 'LIMIT' | 'MARKET';
    side: 'BUY' | 'SELL';
    price: string;
    origQty: string;
    origSum: string;
    executedPrice: string;
    executedQty: string;
    executedSum: string;
    executedPercent: number;
    status: string;
    active: boolean;
    clientOrderId: string;
    created_at: string;
  };
}

export interface OpenOrdersResponse {
  success: boolean;
  message: string;
  result: {
    orders: Array<{
      symbol: string;
      type: 'LIMIT' | 'MARKET';
      side: 'BUY' | 'SELL';
      price: string;
      origQty: string;
      origSum: string;
      executedPrice: string;
      executedQty: string;
      executedSum: string;
      executedPercent: number;
      status: string;
      active: boolean;
      clientOrderId: string;
      created_at: string;
    }>;
  };
}

export interface BalanceInfo {
  asset: string;
  faName: string;
  fiat: boolean;
  value: string;
  locked: string;
}

export interface BalancesResponse {
  success: boolean;
  message: string;
  result: {
    balances: {
      [key: string]: BalanceInfo;
    };
  };
}

// ==================== Class ====================

export class WallexPurchasingService {
  private client: ReturnType<typeof axios.create>;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.wallex.ir/v1/account/',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.WALLEX_X_API_Key || ''
      }
    });
  }

  /**
   * Generate a unique client_id with timestamp
   * Format: timestamp-randomstring
   */
  private generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * Place a buy or sell order on Wallex
   * @param orderData - Order details {symbol, type, side, price, quantity, client_id}
   * @returns Order response with order ID and status
   */
  async placeOrder(orderData: PlaceOrderRequest): Promise<OrderResponse> {
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
        client_id: orderData.client_id || this.generateClientId() // Generate if not provided
      };

      // Add price for LIMIT orders
      if (orderData.type === 'LIMIT') {
        requestBody.price = orderData.price;
      }

      console.log(`Placing ${orderData.side} order for ${orderData.symbol}:`, requestBody);

      // Make POST request to Wallex
      const response = await this.client.post<OrderResponse>('/orders', requestBody);

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
   * Get order details by clientOrderId
   * @param clientOrderId - The order ID to retrieve details for
   * @returns Order response with current order status and details
   */
  async getOrder(clientOrderId: string): Promise<OrderResponse> {
    try {
      if (!clientOrderId) {
        throw new Error('clientOrderId is required');
      }

      console.log(`Fetching order details for: ${clientOrderId}`);

      // Make GET request to Wallex
      const response = await this.client.get<OrderResponse>(`/orders/${clientOrderId}`);

      console.log(`Order details retrieved successfully for ${clientOrderId}`);

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to get order details';
      console.error('Error fetching order details:', errorMessage);
      
      throw {
        success: false,
        message: errorMessage,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Cancel an active order
   * @param clientOrderId - The order ID to cancel
   * @returns Response indicating success/failure of cancellation
   */
  async cancelOrderById(clientOrderId: string): Promise<{
    success: boolean;
    message: string;
    result?: any;
  }> {
    try {
      if (!clientOrderId) {
        throw new Error('clientOrderId is required');
      }

      console.log(`Cancelling order: ${clientOrderId}`);

      // Make DELETE request to Wallex with query parameter
      const response = await this.client.delete<any>('/orders', {
        params: {
          clientOrderId
        }
      });

      console.log(`Order ${clientOrderId} cancelled successfully`);

      return {
        success: response.data.success || response.status === 200,
        message: response.data.message || 'Order cancelled successfully',
        result: response.data.result
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to cancel order';
      console.error('Error cancelling order:', errorMessage);
      
      return {
        success: false,
        message: errorMessage,
        result: error.response?.data
      };
    }
  }

  /**
   * Get list of user's active orders
   * @param symbol - Optional: filter by specific trading pair symbol
   * @returns Response containing array of active orders
   */
  async getOpenOrders(symbol?: string): Promise<OpenOrdersResponse> {
    try {
      console.log(`Fetching open orders${symbol ? ` for ${symbol}` : ''}`);

      // Build query parameters
      const params: any = {};
      if (symbol) {
        params.symbol = symbol;
      }

      // Make GET request to Wallex
      const response = await this.client.get<OpenOrdersResponse>('/openOrders', { params });

      console.log(`Retrieved ${response.data.result.orders.length} open orders`);

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to get open orders';
      console.error('Error fetching open orders:', errorMessage);
      
      throw {
        success: false,
        message: errorMessage,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Get wallet balances for all assets/cryptocurrencies
   * @returns Response containing all wallet balances organized by asset symbol
   */
  async getBalances(baseAsset: string): Promise<string> {
    try {
      console.log('Fetching wallet balances');


      // Make GET request to Wallex
      const response = await this.client.get<BalancesResponse>('/balances');
      
      if (baseAsset) {
        const assetBalance = response.data.result.balances[baseAsset].value;
        const lockedBalance = response.data.result.balances[baseAsset].locked;
        const availableBalance = (parseFloat(assetBalance) - parseFloat(lockedBalance)).toString();
        
        console.log(`Balance for ${baseAsset}: ${assetBalance}`);

        return availableBalance
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to get balances';
      console.error('Error fetching balances:', errorMessage);
      
      throw {
        success: false,
        message: errorMessage,
        error: error.response?.data || error.message
      };
    }
  }
}
