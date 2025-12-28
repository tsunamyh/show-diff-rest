import fs from 'fs';
import path from 'path';

interface PercentageRecord {
    time: string;
    value: number;
    exchangeBuyPrice?: number;
    binanceSellPrice?: number;
    buyVolume?: number;
}

interface CurrencyDiffTracker {
    symbol: string;
    statusCompare: string;
    maxDifference: number;
    percentages: PercentageRecord[];
}

interface HistoryFile {
    timestamp: string;
    exchangeName: string;
    last24h: CurrencyDiffTracker[];
    lastWeek: CurrencyDiffTracker[];
    allTime: CurrencyDiffTracker[];
}

const HISTORY_DIR = path.join(process.cwd(), './database/history');

export function ensureHistoryDir() {
    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
}

function getTop10Currencies(currencies: CurrencyDiffTracker[]): CurrencyDiffTracker[] {
    return currencies
        .sort((a, b) => b.maxDifference - a.maxDifference)
        .slice(0, 10)
        .map(currency => ({
            ...currency,
            percentages: currency.percentages.slice(0, 10)
        }));
}

export function saveHistoryToFile(exchange: 'wallex' | 'okex', tracker: Map<string, CurrencyDiffTracker>) {
    ensureHistoryDir();
    const filePath = path.join(HISTORY_DIR, `${exchange}_history.json`);
    
    try {
        const now = new Date().getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        const allCurrencies = Array.from(tracker.values());
        
        // Filter by time periods
        const last24h = allCurrencies
            .map(currency => ({
                ...currency,
                percentages: currency.percentages.filter(p => {
                    const recordTime = new Date(p.time).getTime();
                    return (now - recordTime) <= oneDayMs;
                })
            }))
            .filter(c => c.percentages.length > 0);
        
        const lastWeek = allCurrencies
            .map(currency => ({
                ...currency,
                percentages: currency.percentages.filter(p => {
                    const recordTime = new Date(p.time).getTime();
                    return (now - recordTime) <= sevenDaysMs;
                })
            }))
            .filter(c => c.percentages.length > 0);
        
        const allTime = allCurrencies.filter(c => c.percentages.length > 0);
        
        // Create structured data
        const structuredData = {
            timestamp: new Date().toISOString(),
            exchangeName: exchange,
            last24h: getTop10Currencies(last24h),
            lastWeek: getTop10Currencies(lastWeek),
            allTime: getTop10Currencies(allTime)
        };
        
        fs.writeFileSync(filePath, JSON.stringify(structuredData, null, 2), 'utf-8');
        console.log(`Saved ${exchange} history with structured time periods`);
    } catch (error) {
        console.error(`Error saving ${exchange} history:`, error);
    }
}

export function loadHistoryFromFile(exchange: 'wallex' | 'okex'): Map<string, CurrencyDiffTracker> {
    ensureHistoryDir();
    const filePath = path.join(HISTORY_DIR, `${exchange}_history.json`);
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Check if file is empty or not valid JSON
            if (!content || !content.trim()) {
                console.log(`${exchange} history file is empty, starting fresh`);
                return new Map();
            }
            
            const parsed: HistoryFile = JSON.parse(content);
            const map = new Map<string, CurrencyDiffTracker>();
            
            // Reconstruct Map from allTime data
            if (parsed.allTime && parsed.allTime) {
                parsed.allTime.forEach((item: CurrencyDiffTracker) => {
                    map.set(item.symbol, item);
                });
            }
            
            console.log(`Loaded ${map.size} currencies from ${exchange} history`);
            return map;
        }
    } catch (error) {
        console.error(`Error loading ${exchange} history, starting fresh:`, error);
    }
    return new Map();
}

export function getDataByPeriod(exchange: 'wallex' | 'okex'): HistoryFile {
    ensureHistoryDir();
    const filePath = path.join(HISTORY_DIR, `${exchange}_history.json`);
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Check if file is empty or not valid JSON
            if (!content || !content.trim()) {
                console.log(`${exchange} data by period file is empty`);
                return {
                    timestamp: null,
                    exchangeName: exchange,
                    last24h: null,
                    lastWeek: null,
                    allTime: null
                };
            }
            
            const parsed: HistoryFile = JSON.parse(content);
            
            return {
                timestamp: parsed.timestamp || null,
                exchangeName: parsed.exchangeName || null,
                last24h: parsed.last24h || null,
                lastWeek: parsed.lastWeek || null,
                allTime: parsed.allTime || null
            };
        }
    } catch (error) {
        console.error(`Error loading ${exchange} data by period:`, error);
    }
    
    return {
        timestamp: null,
        exchangeName: exchange,
        last24h: null,
        lastWeek: null,
        allTime: null
    };
}

export type { CurrencyDiffTracker, PercentageRecord };