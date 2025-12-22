import 'dotenv/config';
import { server } from "../server";
import { intervalFunc } from '../components/comparisons/exchanges-vs-binance/wallex-binance';

const port: number = Number(process.env.PORT) || 3000;

async function start() {
  server.listen(port, () => {
    console.log("Server is listening on port")
  });
  try {
      intervalFunc()
    } catch (error) {
    console.log("hanooz shoroo nashode:", error.message);
  }
}

start()