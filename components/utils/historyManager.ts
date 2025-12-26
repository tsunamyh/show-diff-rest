import fs from 'fs';
import path from 'path';

interface PercentageRecord {
    time: string;
    value: number;
}

interface CurrencyDiffTracker {
    symbol: string;
    statusCompare: string;
    maxDifference: number;
    percentages: PercentageRecord[];
}

const HISTORY_DIR = path.join(process.cwd(), './fswritefiles/history');

// Ensure history directory exists
export function ensureHistoryDir() {
    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
}

// Load history from file
export function loadHistoryFromFile(exchange: 'wallex' | 'okex'): Map<string, CurrencyDiffTracker> {
    ensureHistoryDir();
    const filePath = path.join(HISTORY_DIR, `${exchange}_history.json`);
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            const map = new Map<string, CurrencyDiffTracker>();
            if (parsed.data && Array.isArray(parsed.data)) {
                parsed.data.forEach((item: CurrencyDiffTracker) => {
                    map.set(item.symbol, item);
                });
            }
            console.log(`[${exchange.toUpperCase()}] Loaded ${map.size} currencies from history`);
            return map;
        }
    } catch (error) {
        console.error(`Error loading ${exchange} history:`, error);
    }
    return new Map();
}

// Save history to file
export function saveHistoryToFile(exchange: 'wallex' | 'okex', tracker: Map<string, CurrencyDiffTracker>) {
    ensureHistoryDir();
    const filePath = path.join(HISTORY_DIR, `${exchange}_history.json`);
    
    try {
        const data = Array.from(tracker.values()).map(item => ({
            ...item,
            percentages: item.percentages.slice(0, 100) // Keep last 100 records
        }));
        fs.writeFileSync(filePath, JSON.stringify({
            timestamp: new Date().toISOString(),
            data: data
        }, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error saving ${exchange} history:`, error);
    }
}

// Filter data by time period (hours)
export function filterByTimePeriod(data: CurrencyDiffTracker[], hours: number): CurrencyDiffTracker[] {
    const now = new Date().getTime();
    const periodMs = hours * 60 * 60 * 1000;

    return data.map(currency => ({
        ...currency,
        percentages: currency.percentages.filter(record => {
            const recordTime = new Date(record.time).getTime();
            return (now - recordTime) <= periodMs;
        })
    })).filter(currency => currency.percentages.length > 0);
}

// Get data by time period
export function getDataByPeriod(exchange: 'wallex' | 'okex') {
    const allTimeData = Array.from(loadHistoryFromFile(exchange).values());

    return {
        last24h: filterByTimePeriod(allTimeData, 24),
        lastWeek: filterByTimePeriod(allTimeData, 24 * 7),
        allTime: allTimeData
    };
}

export type { CurrencyDiffTracker, PercentageRecord };