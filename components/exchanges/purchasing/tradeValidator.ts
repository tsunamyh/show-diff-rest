import { wallexGetBalances, wallexGetOpenOrders, wallexPlaceOrder } from "./parchasing-controller";

// ==================== Types ====================

export interface ValidateTradeConfig {
  maxTradeAmountInTMN: number;       // حداکثر مبلغ خرید برای یک trade (تومان)
  maxBalanceUsagePercent: number;    // حداکثر درصد موجودی برای استفاده (0-100)
  allowDuplicatePosition: boolean;   // آیا میتونیم برای یک symbol دوباره بخریم؟
  minProfitPercent: number;          // حداقل سود مورد نیاز (از myPercent استفاده کن)
}

// ==================== Default Configuration ====================
const defaultWallexConfig: ValidateTradeConfig = {
  maxTradeAmountInTMN: parseFloat(process.env.WALLEX_MAX_TRADE_AMOUNT || '600000'),    // حداکثر 600,000 تومان
  maxBalanceUsagePercent: parseFloat(process.env.WALLEX_MAX_BALANCE_PERCENT || '80'),  // حداکثر 80% موجودی
  allowDuplicatePosition: process.env.WALLEX_ALLOW_DUPLICATE === 'true',  // default: false
  minProfitPercent: parseFloat(process.env.MYPERCENT || '1')
};

export interface TradeValidationResult {
  success: boolean;
  reason?: string;
  finalQuantity?: number;
  executedOrderId?: string;
  orderId?: string;
}

// ==================== Trade Validator ====================

/**
 * Validate trade conditions before placing an order
 * Checks: balance, quantity limits, duplicate positions
 * 
 * @param symbol - Trading pair symbol (e.g., BTCTMN, ETHUSDT)
 * @param calculatedQuantity - Quantity calculated from price comparison
 * @param price - Current ask price
 * @param side - BUY or SELL
 */
export async function validateAndExecuteTrade(
  symbol: string,
  calculatedQuantity: number,
  price: number,
  side: 'BUY' | 'SELL'
): Promise<TradeValidationResult> {
  // Use provided config or default config
  const config = defaultWallexConfig;

  try {
    console.log(`\n🔍 Validating trade for ${symbol}...`);

    // ==================== Step 1: Limit quantity by max trade amount ====================
    const maxQuantityByAmount = config.maxTradeAmountInTMN / price;
    let validQuantity = Math.min(calculatedQuantity, maxQuantityByAmount);
    const tradeAmount = validQuantity * price;
    console.log(`📊 Step 1 - Amount limit: ${config.maxTradeAmountInTMN} TMN | Quantity: ${calculatedQuantity} → ${validQuantity} | Trade Amount: ${tradeAmount.toFixed(0)} TMN`);

    // ==================== Step 2: Check balance ====================
    let baseCurrency = 'TMN'; // Default for BUY orders (need TMN)

    // For SELL orders, determine what currency we're selling
    if (side === 'SELL') {
      if (symbol.includes('TMN')) {
        baseCurrency = symbol.replace('TMN', ''); // e.g., BTCTMN → BTC
      } else if (symbol.includes('USDT')) {
        baseCurrency = symbol.replace('USDT', ''); // e.g., BTCUSDT → BTC
      }
    }

    try {
      const availableBalance = await wallexGetBalances(baseCurrency);
      const availableAmount = parseFloat(availableBalance);
      const maxUsableAmount = (availableAmount * config.maxBalanceUsagePercent) / 100;

      if (side === 'BUY') {
        const neededBalance = validQuantity * price;
        console.log(`   Needed: ${neededBalance} TMN`);

        if (neededBalance > maxUsableAmount) {
          console.log(`   ⚠️ Not enough balance! Adjusting quantity: Have ${maxUsableAmount} TMN, need ${neededBalance} TMN`);
          return {
            success: false,
            reason: `Not enough balance. Need ${neededBalance} TMN but only have ${maxUsableAmount} TMN`
          };
        }
      } else {
        // SELL order
        if (availableAmount < validQuantity) {
          console.log(`   ⚠️ Not enough ${baseCurrency}! Have ${availableAmount}, need ${validQuantity}`);
          return {
            success: false,
            reason: `Not enough balance. Need ${validQuantity} ${baseCurrency} but only have ${availableAmount} ${baseCurrency}`
          };
        }
      }

    } catch (balanceError: any) {
      return {
        success: false,
        reason: `Failed to check balance: ${balanceError.message}`
      };
    }

    // ==================== Step 3: Check for duplicate positions ====================
    if (!config.allowDuplicatePosition && side === 'BUY') {
      try {
        const openOrders = await wallexGetOpenOrders(symbol);
        const hasBuyPosition = openOrders.result.orders.length > 0;

        if (hasBuyPosition) {
          console.log(`📍 Step 3 - Position check:`);
          console.log(`   Open BUY positions for ${symbol}: ${openOrders.result.orders.filter(order => order.side === 'BUY' && order.active).length}`);
          return {
            success: false,
            reason: `Already have an open BUY position for ${symbol}`
          };
        }

      } catch (positionError: any) {
        return {
          success: false,
          reason: `Failed to check open positions: ${positionError.message}`
        };
      }
    }

    // ==================== Step 4: Place order with final quantity ====================
    try {
      console.log(`\n✅ All validations passed!`);
      console.log(`📤 Placing ${side} order: ${validQuantity} ${symbol} @ ${price}`);

      const orderResult = await wallexPlaceOrder({
        symbol: symbol.toUpperCase(),
        type: 'LIMIT',
        side,
        price: price.toString(),
        quantity: validQuantity.toString()
      });

      if (orderResult.success) {
        console.log(`✨ Order placed successfully!`);
        console.log(`   Order ID: ${orderResult.result?.clientOrderId}`);
        console.log(`   Quantity: ${validQuantity}`);

        return {
          success: true,
          finalQuantity: validQuantity,
          executedOrderId: orderResult.result?.clientOrderId,
          orderId: orderResult.result?.clientOrderId,
          reason: `Order placed successfully`
        };
      } else {
        return {
          success: false,
          reason: `Failed to place order: ${orderResult.message}`
        };
      }

    } catch (orderError: any) {
      return {
        success: false,
        reason: `Error placing order: ${orderError.message}`
      };
    }

  } catch (error: any) {
    console.error(`❌ Trade validation error:`, error);
    return {
      success: false,
      reason: `Trade validation failed: ${error.message}`
    };
  }
}
