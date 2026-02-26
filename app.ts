import express from "express";
import path from "path";
// import { getLatestRowsInfo } from "./components/comparisons/exchanges-vs-binance/wallex-binance";
import { getUsdtToTmnRate } from "./components/1-tracker/wallexPriceTracker";
import './components/3-comparisons/2-exchanges-vs-binance/wallex-binance'; // Start price comparison
import { getStartBallance } from "./components/3-comparisons/1-purchasing/parchasing-controller";
import { loadAllOrdersByExchangeName } from "./components/utils/dbManager";

const app = express()

app.use(express.static(path.join(__dirname, "public")));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.json());

// API endpoint برای دریافت اطلاعات مقایسه قیمت‌ها
// app.get('/api/comparison', (req, res) => {
//   try {
//     const rowsInfo = getLatestRowsInfo();
//     res.json({
//       data: rowsInfo,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch comparison data' });
//   }
// });

// API endpoint برای دریافت تمام قیمت‌ها
// app.get('/api/prices', async (req, res) => {
//   try {
//     const orderBooks = await getAllOrderBooks();

//     res.json({
//       binanceOrderbooks: orderBooks?.binanceOrderbooks,
//       wallexOrderbooks: orderBooks?.wallexOrderbooks,
//       usdtToTmnRate: rate,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch prices' });
//   }
// });

app.get("/", function (req, res) {
  // console.log("Home");
  res.redirect("./diff")
})

app.get('/diff', function (req, res) {
  const rate = getUsdtToTmnRate();
  const startBallance = getStartBallance();
  res.render("diff", {
    usdtToTmnRate: rate === 1 ? " به روز نشده" : rate,
    startBallance: startBallance === "0" ? "در حال دریافت..." : startBallance,
    startDate: new Date().toLocaleString()
  })
})

// API endpoint برای دریافت تمام سفارشات باز برای یک صرافی
app.get('/api/orders/:exchange', async (req, res) => {
  try {
    const exchange = req.params.exchange?.toLowerCase();
    // اعتبارسنجی نام صرافی
    if (!['wallex', 'okex', 'nobitex'].includes(exchange)) {
      return res.status(400).json({
        error: 'صرافی نامعتبر است',
        validExchanges: ['wallex', 'okex', 'nobitex']
      });
    }

    const orders = await loadAllOrdersByExchangeName(exchange as 'wallex' | 'okex' | 'nobitex');
    
    res.json({
      exchange: exchange,
      count: orders.length,
      orders: orders,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'خطا در دریافت سفارشات',
      message: error instanceof Error ? error.message : 'خطای نامشخص'
    });
  }
})

// 404 - باید آخر باشد و از app.use استفاده کنید
app.use((req, res) => {
  res.status(404).send('<h1 align="center" style="color:red">404 Not Found</h1>');
})

export { app };