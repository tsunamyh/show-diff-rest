import express from "express";
import path from "path";
import { getLatestRowsInfo } from "./components/wallex-binance";
import { getUsdtToTmnRate } from "./components/exchanges/wallexPriceTracker";
import './components/wallex-binance'; // Start price comparison

const app = express()

app.use(express.static(path.join(__dirname, "public")));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.json());

// API endpoint برای دریافت اطلاعات مقایسه قیمت‌ها
app.get('/api/comparison', (req, res) => {
  try {
    const rowsInfo = getLatestRowsInfo();
    res.json({
      data: rowsInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comparison data' });
  }
});

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

  res.render("diff", {
    usdtToTmnRate: rate === 1 ? " به روز نشده" : rate,
    date: new Date().toLocaleString()
  })
})

// 404 - باید آخر باشد و از app.use استفاده کنید
app.use((req, res) => {
  res.status(404).send('<h1 align="center" style="color:red">404 Not Found</h1>');
})

console.log("app is running");
export { app };