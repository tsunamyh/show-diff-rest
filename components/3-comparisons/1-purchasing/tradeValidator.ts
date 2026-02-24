import { wallexGetBalances, wallexGetOpenOrders, wallexPlaceOrder } from "./parchasing-controller";
import commonSymbols from "../../../commonSymbols/wallex_binance_common_symbols";

/**
 * Get amount and price precision for a trading pair
 * @param symbol - Trading pair symbol (e.g., BTCTMN, ETHUSDT)
 * @returns Object with amount and price precision
 */
function getPrecision(symbol: string): { amount: number; price: number } {
  const pair = symbol.toUpperCase();

  try {
    if (symbol.endsWith('TMN')) {
      const precision = commonSymbols.symbols.wallex_symbol.tmnPairs[pair];
      if (precision) {
        return {
          amount: precision.amount_precision,
          price: precision.price_precision
        };
      }
    } else if (symbol.endsWith('USDT')) {
      const precision = commonSymbols.symbols.wallex_symbol.usdtPairs[pair];
      if (precision) {
        return {
          amount: precision.amount_precision,
          price: precision.price_precision
        };
      }
    }
  } catch (error) {
    console.warn(`Could not find precision for ${symbol}, using defaults`);
  }

  // Default fallback
  console.warn(`⚠️ Could not find precision for ${symbol}, using defaults (10, 10)`);
  return { amount: 10, price: 10 };
}

/**
 * Format quantity and price based on symbol precision
 */
function formatOrderData(
  symbol: string,
  quantity: number,
  price: number
): { quantity: string; price: string } {
  const precision = getPrecision(symbol);

  const formattedQuantity = (Math.floor(quantity * Math.pow(10, precision.amount)) / Math.pow(10, precision.amount)).toString();
  const formattedPrice = (Math.floor(price * Math.pow(10, precision.price)) / Math.pow(10, precision.price)).toString();

  return {
    quantity: formattedQuantity,
    price: formattedPrice
  };
}

// ==================== Types ====================

export interface ValidateTradeConfig {
  maxTradeAmountInTMN: number;       // حداکثر مبلغ خرید برای یک trade (تومان)
  minTradeAmountInTMN: number;      // حداقل مبلغ خرید برای یک trade (تومان)
  maxBalanceUsagePercent: number;    // حداکثر درصد موجودی برای استفاده (0-100)
  allowDuplicatePosition: boolean;   // آیا میتونیم برای یک symbol دوباره بخریم؟
  AskBidDifferencePercentInWallex?: number;          // درصد داخلی دلخواه برای محاسبه سود
}

// ==================== Default Configuration ====================
const defaultWallexConfig: ValidateTradeConfig = {
  maxTradeAmountInTMN: parseFloat(process.env.WALLEX_MAX_TRADE_AMOUNT || '600000'),    // حداکثر 600,000 تومان
  minTradeAmountInTMN: parseFloat(process.env.WALLEX_MIN_TRADE_AMOUNT || '60000'),     // حداقل 60,000 تومان
  maxBalanceUsagePercent: parseFloat(process.env.WALLEX_MAX_BALANCE_PERCENT || '97'),  // حداکثر 80% موجودی
  allowDuplicatePosition: process.env.WALLEX_ALLOW_DUPLICATE === 'true',  // default: false
  AskBidDifferencePercentInWallex: parseFloat(process.env.INTERNAL_PERCENT || '0.5'),
};
console.log({
  maxTradeAmountInTmn: defaultWallexConfig.maxTradeAmountInTMN,
  minTradeAmountInTmn: defaultWallexConfig.minTradeAmountInTMN,
  maxBalanceUsagePercent: defaultWallexConfig.maxBalanceUsagePercent,
  allowDuplicatePosition: defaultWallexConfig.allowDuplicatePosition,
  AskBidDifferencePercentInWallex: defaultWallexConfig.AskBidDifferencePercentInWallex,
});

export interface BuyTradeValidationResult {
  success: boolean;
  reason?: string;
  finalQuantity?: string;
  // executedOrderId?: string;
  orderId?: string;
  stopLoss?: string | number;
  symbol?: string;
  type?: string;
  side?: string;
  price?: string;
  origQty?: string;
  origSum?: string;
  executedPrice?: string;
  executedQty?: string;
  executedSum?: string;
  executedPercent?: number;
}

// ==================== Trade Validator ====================

/**
 * Validate trade conditions before placing an order
 * Checks: balance, quantity limits, duplicate positions
 * 
 * @param symbol - Trading pair symbol (e.g., BTCTMN, ETHUSDT)
 * @param amountCurrency - Quantity calculated from price comparison
 * @param price - Current ask price
 * @param side - BUY or SELL
 * @param amountTmn - (Optional) Custom trade amount in TMN
 * @param askBidDifferencePercentInWallex - (Optional) Custom internal percent for calculations
 * @returns BuyTradeValidationResult indicating success or failure and details
 */
export async function validateAndBuyTrade(
  symbol: string,
  amountCurrency: number,
  price: number,
  side: 'BUY' | 'SELL',
  amountTmn?: number,
  askBidDifferencePercentInWallex?: number,
): Promise<BuyTradeValidationResult> {
  // Use provided config or default config
  const config = defaultWallexConfig;

  // ==================== Step 1: Check the minimum available amount(quantity) for trade ====================
  if (amountTmn !== undefined && amountTmn <= config.minTradeAmountInTMN) {
    console.log(`📊 Step 1 :${symbol}: Not enough amount for trade: ${amountTmn} TMN < ${config.minTradeAmountInTMN} TMN`)
    return {
      success: false,
      reason: `Amount for trade is less than the minimum trade amount limit`
    };
  }
  // ==================== Step 2: check Ask & Bid difference percent in Wallex ====================
  if (askBidDifferencePercentInWallex !== undefined && askBidDifferencePercentInWallex > (config.AskBidDifferencePercentInWallex)) {
    console.log(`📊 Step 2 :${symbol} Ask-Bid diff percent is greater than the allowed internal percent: ${askBidDifferencePercentInWallex} > ${config.AskBidDifferencePercentInWallex}`);
    return {
      success: false,
      reason: `Ask-Bid difference percent is greater than the allowed internal percent`
    };
  }
  // ==================== Step 3: Limit quantity by max trade amount and amountCurrency ====================
  const maxAmountCurrency = config.maxTradeAmountInTMN / price;
  let validAmountCurrency = Math.min(amountCurrency, maxAmountCurrency);
  // validQuantity باید مینیمم و ماکزیمم داشته باشه
  //  مثلا اگر 400 هزار تومان برای خرید موجود بود و موجودی کیف پول کمتر از 400 بود
  //  و از حداقل امکان خرید بیشتر بود معامله کنسل نشه
  const amountTmnForBuy = validAmountCurrency * price; //needed Amount مبلغ مورد نیاز برای خرید
  if (amountTmnForBuy < config.minTradeAmountInTMN) {
    console.log(`📊 Step 3 - Trade amount is less than minimum trade amount limit: ${amountTmnForBuy.toFixed(0)} TMN < ${config.minTradeAmountInTMN} TMN`);
    return {
      success: false,
      reason: `Trade amount is less than the minimum trade amount limit`
    };
  }
  // ==================== Step 4: Check for duplicate positions ====================
  if (!config.allowDuplicatePosition && side === 'BUY') {
    try {
      const openOrders = await wallexGetOpenOrders(symbol);
      const hasBuyPosition = openOrders.result.orders.length > 0;

      if (hasBuyPosition) {
        console.log(`📊 Step 4 -positions is open for ${symbol}: ${openOrders.result.orders.length}`);
        return {
          success: false,
          reason: `Already have an open BUY position for ${symbol}`
        };
      }

    } catch (positionError: any) {
      return {
        success: false,
        reason: `Failed API to check open positions: ${positionError.message}`
      };
    }
  }
  // ==================== Step 5: Check balance ====================
  try {
    // For SELL orders, determine what currency we're checking balance
    // if (side === 'SELL') {
    //   if (symbol.endsWith('TMN')) {
    //     baseCurrency = symbol.replace('TMN', ''); // e.g., BTCTMN → BTC
    //   } else if (symbol.endsWith('USDT')) {
    //     baseCurrency = symbol.replace('USDT', ''); // e.g., BTCUSDT → BTC
    //   }
    // }
    let baseCurrency = 'TMN'; // Default for BUY orders (need TMN)

    try {
      const availableBalance = await wallexGetBalances(baseCurrency);
      const availableAmount = parseFloat(availableBalance);
      const maxUsableAmount = (availableAmount * config.maxBalanceUsagePercent) / 100;
      // if (side === 'BUY') {
      if (amountTmnForBuy > maxUsableAmount) {
        console.log(`📊 Step 5 - Not enough balance! Adjusting quantity: Have ${maxUsableAmount} TMN, need ${amountTmnForBuy} TMN`);
        return {
          success: false,
          reason: `Not enough balance. Need ${amountTmnForBuy} TMN but only have ${maxUsableAmount} TMN`
        };
      }
    } catch (balanceError: any) {
      return {
        success: false,
        reason: `Step 5 API Failed to check balance: ${balanceError.message}`
      };
    }
    // ==================== Step 6: Place order with final quantity ====================
    try {
      console.log(`\n✅ All validations passed!`);
      console.log(`📤 Placing ${side} order: ${validAmountCurrency} ${symbol} @ ${price}`);

      // Format quantity and price based on symbol precision
      const formatted = formatOrderData(symbol, validAmountCurrency, price);

      const orderResult = await wallexPlaceOrder({
        symbol: symbol.toUpperCase(),
        type: 'LIMIT',
        side,
        price: formatted.price,
        quantity: formatted.quantity
      });

      if (orderResult.success) {
        console.log(`✨ Order placed successfully!symbol: ${symbol}`);
        return {
          symbol: orderResult.result?.symbol,
          type: orderResult.result?.type,
          side: orderResult.result?.side,
          price: orderResult.result?.price,
          origQty: orderResult.result?.origQty,
          origSum: orderResult.result?.origSum,
          executedPrice: orderResult.result?.executedPrice,
          executedQty: orderResult.result?.executedQty,
          executedSum: orderResult.result?.executedSum,
          executedPercent: orderResult.result?.executedPercent,
          success: true,
          finalQuantity: validAmountCurrency.toString(),
          // executedOrderId: orderResult.result?.clientOrderId,
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

//===========================================================================================================================
/**
 * Validate trade conditions before placing an order
 * Checks: balance, quantity limits, duplicate positions
 * 
 * @param symbol - Trading pair symbol (e.g., BTCTMN, ETHUSDT)
 * @param amountCurrency - Quantity calculated from price comparison
 * @param price - Current ask price
 * @param side - BUY or SELL
 * @param amountTmn - (Optional) Custom trade amount in TMN
 * @param askBidDifferencePercentInWallex - (Optional) Custom internal percent for calculations
 * @returns SellTradeValidationResult indicating success or failure and details
 */
export async function validateAndSellTrade(
  symbol: string,
  amountCurrency: number,
  price: number,
  side: 'BUY' | 'SELL',
  amountTmn?: number,
  askBidDifferencePercentInWallex?: number
): Promise<BuyTradeValidationResult> {

  const formatted = formatOrderData(symbol, amountCurrency, price);
  const amountTmnForSell = +formatted.quantity * +formatted.price; //needed Amount مبلغ مورد نیاز برای فروش
  if (amountTmnForSell < defaultWallexConfig.minTradeAmountInTMN) {
    console.log(`📊 SELL Step 1${symbol}: Trade amount is less than minimum trade amount limit: ${amountTmnForSell.toFixed(0)} TMN < ${defaultWallexConfig.minTradeAmountInTMN} TMN`);
    return {
      success: false,
      reason: `Trade amount is less than the minimum trade amount limit`
    };
  }
  try {
    const orderResult = await wallexPlaceOrder({
      symbol: symbol.toUpperCase(),
      type: 'LIMIT',
      side,
      price: formatted.price,
      quantity: formatted.quantity
    });
    if (orderResult.success) {
      console.log(`✨ SELL Order placed successfully! symbol: ${symbol}`);
      return {
        success: true,
        finalQuantity: amountCurrency.toString(),
        // executedOrderId: orderResult.result?.clientOrderId,
        orderId: orderResult.result?.clientOrderId,
        reason: `SELL Order placed successfully`
      };
    }
  } catch (error: any) {
    console.error(`❌ Error placing SELL order:`, error);
    return {
      success: false,
      reason: `Error placing SELL order: ${error.message}`
    };
  }
}

