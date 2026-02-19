import { wallexCancelOrderById, wallexGetOrder } from "./parchasing-controller";
import { validateAndBuyTrade } from "./tradeValidator";

/**
 * Loss Protection Monitor
 * Monitors open positions and closes them if loss exceeds threshold
 */

interface MonitoredPosition {
  symbol: string;
  buyOrderId: string;
  sellOrderId?: string;
  buyPrice: number;
  quantity: number;
  buyedAt: Date;
  maxLossPercent: number; // e.g., 2 for 2% loss
}

class LossProtectionMonitor {
  private positions: Map<string, MonitoredPosition> = new Map();
  private monitorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private checkIntervalMs = 5000; // Check every 5 seconds

  /**
   * Start monitoring a position for loss
   */
  public startMonitoring(position: MonitoredPosition): void {
    const key = `${position.symbol}_${position.buyOrderId}`;
    
    if (this.monitorIntervals.has(key)) {
      console.warn(`⚠️  Position ${key} is already being monitored`);
      return;
    }

    this.positions.set(key, position);
    
    console.log(`📊 Started loss protection monitoring for ${position.symbol}`);
    console.log(`   Buy Price: ${position.buyPrice.toFixed(2)}`);
    console.log(`   Quantity: ${position.quantity}`);
    console.log(`   Max Loss: ${position.maxLossPercent}%`);

    // Start monitoring interval
    const interval = setInterval(() => {
      this.checkPosition(key, position);
    }, this.checkIntervalMs);

    this.monitorIntervals.set(key, interval);
  }

  /**
   * Check if position has excessive loss
   */
  private async checkPosition(key: string, position: MonitoredPosition): Promise<void> {
    try {
      // Get current buy order status
      const buyOrder = await wallexGetOrder(position.buyOrderId);
      
      if (!buyOrder.success || !buyOrder.result) {
        console.warn(`⚠️  Could not fetch buy order status for ${position.symbol}`);
        return;
      }

      // If buy order is still not fully executed, continue waiting
      if (buyOrder.result.executedPercent < 100) {
        console.log(`⏳ Buy order ${position.symbol} not fully executed: ${(buyOrder.result.executedPercent * 100).toFixed(1)}%`);
        return;
      }

      // Get current market price (use the executedPrice from buy order)
      const executedPrice = parseFloat(buyOrder.result.executedPrice);
      const executedQty = parseFloat(buyOrder.result.executedQty);

      // Get sell order if it exists
      if (position.sellOrderId) {
        const sellOrder = await wallexGetOrder(position.sellOrderId);
        
        if (sellOrder.success && sellOrder.result) {
          const currentSellPrice = parseFloat(sellOrder.result.price);
          
          // Calculate loss
          const lossPercent = ((executedPrice - currentSellPrice) / executedPrice) * 100;
          
          console.log(`📈 ${position.symbol}: Buy ${executedPrice.toFixed(2)} | Sell Price ${currentSellPrice.toFixed(2)} | Loss: ${lossPercent.toFixed(2)}%`);
          
          // If loss exceeds threshold
          if (lossPercent > position.maxLossPercent) {
            console.error(`❌ LOSS EXCEEDS THRESHOLD for ${position.symbol}: ${lossPercent.toFixed(2)}% > ${position.maxLossPercent}%`);
            
            // Cancel sell order
            const cancelResult = await wallexCancelOrderById(position.sellOrderId);
            if (cancelResult.success) {
              console.log(`✅ Cancelled SELL order: ${position.sellOrderId}`);
            } else {
              console.error(`❌ Failed to cancel SELL order: ${cancelResult.message}`);
            }
            
            // Place market sell order
            setTimeout(() => {
              console.log(`💨 Placing MARKET SELL for ${position.symbol} at current market price`);
              validateAndBuyTrade(
                position.symbol,
                executedQty, // Use the executed quantity from buy
                currentSellPrice,
                'SELL'
              )
              .then((result) => {
                if (result.success) {
                  console.log(`✨ Market SELL executed successfully`);
                  this.stopMonitoring(key);
                } else {
                  console.error(`❌ Market SELL failed: ${result.reason}`);
                }
              })
              .catch((err) => {
                console.error(`❌ Error executing market SELL:`, err);
              });
            }, 100);
            
            // Stop monitoring this position
            this.stopMonitoring(key);
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Error checking position ${key}:`, error.message);
    }
  }

  /**
   * Stop monitoring a position
   */
  public stopMonitoring(key: string): void {
    const interval = this.monitorIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.monitorIntervals.delete(key);
    }
    this.positions.delete(key);
    console.log(`🛑 Stopped monitoring position: ${key}`);
  }

  /**
   * Stop all monitoring
   */
  public stopAllMonitoring(): void {
    this.monitorIntervals.forEach((interval) => clearInterval(interval));
    this.monitorIntervals.clear();
    this.positions.clear();
    console.log(`🛑 Stopped all monitoring`);
  }

  /**
   * Get monitored positions
   */
  public getPositions(): MonitoredPosition[] {
    return Array.from(this.positions.values());
  }
}

// Export singleton instance
export const lossProtectionMonitor = new LossProtectionMonitor();
export type { MonitoredPosition };
