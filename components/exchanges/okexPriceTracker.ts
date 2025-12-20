import axios from 'axios';
import binance_okex_common_symbols from '../../commonSymbols/okex_binance_common_symbols';

interface OkExOrderbooks {
    exchangeName: string;
    usdtPairs: { [pair: string]: { bid: string[]; ask: string[] } };
}

// ok-ex.io API endpoints
const OKEX_API_URL = 'https://sapi.ok-ex.io/api/v1/spot/public/books';

const axiosInstance = axios.create({
    baseURL: OKEX_API_URL,
    params: {
        limit: 5 // فقط بهترین bid و ask حداقل 5 میتونه باشه
    },
    timeout: 5000
});

const okExOrderbooks: OkExOrderbooks = {
    exchangeName: "okex",
    usdtPairs: {}
};

function createPromisesArray(): { symbol: string; promise: Promise<any>; }[] {
    const okexSymbols = binance_okex_common_symbols.symbols.okex_symbol;
    const promisesArray = [];
    // فرستادن درخواست برای هر سمبل به صورت جداگانه
    for (const symbol of okexSymbols) {
        const promise = axiosInstance.get<any>(OKEX_API_URL, {
            params: {
                symbol: symbol,  // مثلا: USDT-IRT یا BTC-USDT
            },
            timeout: 5000
        });
        promisesArray.push(promise);
    }

    return promisesArray;
}

async function fetchOkexPrices(): Promise<OkExOrderbooks | void> {

    try {
        const promisesArray = createPromisesArray();
        const results = await Promise.allSettled(promisesArray.map(item => item.promise));
    } catch (error) {
        console.error("Error fetching Okex order books:", error);
        throw error;
    }
    // Get Okex symbols from common symbols


}

export {
    fetchOkexPrices
};
