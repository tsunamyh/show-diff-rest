import fs from 'fs';
import path from 'path';

interface WallexData {
  wallex: {
    tmn: {
      [symbol: string]: string[];
    };
    usdt: {
      [symbol: string]: string[];
    };
  };
}

interface BinanceData {
  binance: {
    [symbol: string]: {
      ask: string[];
      bid: string[];
    };
  };
}

interface ComparisonItem {
  symbol: string;
  pair: string;
  wallex_usdt: string;
  wallex_tmn: string;
  binance_usdt: string;
  binance_tmn: string;
  difference_tmn: number;
  difference_percent: number;
  expensive_market: string;
}

interface ComparisonResult {
  timestamp: string;
  totalSymbols: number;
  comparison: ComparisonItem[];
}

const WALLEX_FILE = path.join(process.cwd(), 'wallex_prices_tracker.json');
const BINANCE_FILE = path.join(process.cwd(), 'binance_prices.json');
const OUTPUT_FILE = path.join(process.cwd(), 'price_comparison_sorted.json');
const INTERVAL = 10000; // 10 seconds

function compareAndSort(): void {
  try {
    console.log(`[${new Date().toISOString()}] Starting price comparison...`);

    // خواندن فایل‌های Wallex و Binance
    if (!fs.existsSync(WALLEX_FILE)) {
      console.error('Wallex file not found');
      return;
    }

    if (!fs.existsSync(BINANCE_FILE)) {
      console.error('Binance file not found');
      return;
    }

    const wallexData: WallexData = JSON.parse(fs.readFileSync(WALLEX_FILE, 'utf-8'));
    const binanceData: BinanceData = JSON.parse(fs.readFileSync(BINANCE_FILE, 'utf-8'));

    const wallexUsdt = wallexData.wallex?.usdt || {};
    const binanceSymbols = Object.keys(binanceData.binance || {});

    const comparison: ComparisonItem[] = [];

    // مقایسه قیمت‌های مشترک
    binanceSymbols.forEach((symbol) => {
      const wallexPrice = wallexUsdt[symbol];
      const binancePrice = binanceData.binance[symbol];

      if (wallexPrice && binancePrice) {
        // استخراج قیمت‌ها - استفاده از ask price
        const wallexUsdtPrice = wallexPrice[0];
        const wallexTmnPrice = wallexPrice[1];
        const binanceUsdtPrice = binancePrice.ask[0];
        const binanceTmnPrice = binancePrice.ask[1];

        // بررسی اینکه مقادیر معتبر هستند
        if (!wallexTmnPrice || !binanceTmnPrice || wallexTmnPrice === 'null' || binanceTmnPrice === 'null') {
          return;
        }

        const wallexTmnNum = parseFloat(wallexTmnPrice);
        const binanceTmnNum = parseFloat(binanceTmnPrice);

        // بررسی NaN
        if (isNaN(wallexTmnNum) || isNaN(binanceTmnNum)) {
          return;
        }

        // محاسبه اختلاف
        const differenceTmn = binanceTmnNum - wallexTmnNum;
        const differencePercent = wallexTmnNum > 0 
          ? (differenceTmn / wallexTmnNum) * 100 
          : 0;

        const expensiveMarket = differenceTmn > 0 ? 'Binance' : 'Wallex';

        comparison.push({
          symbol,
          pair: `${symbol}USDT (Binance) vs ${symbol}USDT (Wallex converted to TMN)`,
          wallex_usdt: wallexUsdtPrice,
          wallex_tmn: wallexTmnPrice,
          binance_usdt: binanceUsdtPrice,
          binance_tmn: binanceTmnPrice,
          difference_tmn: parseFloat(Math.abs(differenceTmn).toFixed(2)),
          difference_percent: parseFloat(differencePercent.toFixed(4)),
          expensive_market: expensiveMarket
        });
      }
    });

    // مرتب‌سازی بر اساس اختلاف (بیشترین به کمترین)
    comparison.sort((a, b) => b.difference_tmn - a.difference_tmn);

    const result: ComparisonResult = {
      timestamp: new Date().toISOString(),
      totalSymbols: comparison.length,
      comparison
    };

    // ذخیره در فایل
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
    
    // نمایش خلاصه
    console.log(`[${new Date().toISOString()}] Price comparison completed`);
    console.log(`Total symbols compared: ${comparison.length}`);
    
    if (comparison.length > 0) {
      console.log(`\nTop 5 highest differences:`);
      comparison.slice(0, 5).forEach((item, index) => {
        const marketName = item.expensive_market === 'Binance' ? 'binance' : 'wallex';
        console.log(`  ${index + 1}. ${marketName}(${item.symbol}usdt) is expensive vs wallex(${item.symbol}usdt): ${item.difference_tmn.toFixed(2)} TMN (${item.difference_percent.toFixed(2)}%)`);
      });
      
      console.log(`\nTop 5 lowest differences:`);
      comparison.slice(-5).reverse().forEach((item, index) => {
        const marketName = item.expensive_market === 'Binance' ? 'binance' : 'wallex';
        console.log(`  ${index + 1}. ${marketName}(${item.symbol}usdt) vs wallex(${item.symbol}usdt): ${item.difference_tmn.toFixed(2)} TMN (${item.difference_percent.toFixed(2)}%)`);
      });
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error instanceof Error ? error.message : error);
  }
}

// اجرای اولیه
compareAndSort();

// تنظیم بازه زمانی برای مقایسه
setInterval(compareAndSort, INTERVAL);

console.log(`Price comparison tracker started. Comparing prices every ${INTERVAL / 1000} seconds...`);
