import express from 'express';
import path from 'path';
import { getAllOrderBooks } from './components/exchanges-controller';
import { getUsdtToTmnRate } from './components/exchanges/wallexPriceTracker';
import { getLatestRowsInfo } from './components/price_comparison'; // شروع price comparison
import './components/price_comparison';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');

// API endpoint برای دریافت داده‌ها
app.get('/api/prices', async (req, res) => {
  try {
    const orderBooks = await getAllOrderBooks();
    const rate = getUsdtToTmnRate();
    
    res.json({
      binanceOrderbooks: orderBooks?.binanceOrderbooks,
      wallexOrderbooks: orderBooks?.wallexOrderbooks,
      usdtToTmnRate: rate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

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

// صفحه اصلی
app.get('/', (req, res) => {
  res.render('index', {
    date: new Date().toLocaleString()
  });
});

// صفحه مقایسه قیمت‌ها
app.get('/diff', (req, res) => {
  res.render('diff', {
    date: new Date().toLocaleString()
  });
});

// 404 - آخری باید باشد
app.use((req, res) => {
  res.status(404).send('<h1 align="center" style="color:red">404 Not Found</h1>');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export { app };
