import type { Candle, MarketTicker } from "@/types/trading";
import {
  fetchTickersClientDirect,
  fetchKlinesClientDirect,
  type RawTicker,
} from "@/lib/binance/providers";

const BASE = "/api/binance";
let activeProvider = "unknown";

export function getActiveProvider() {
  return activeProvider;
}

function mapTickers(data: RawTicker[]): MarketTicker[] {
  return data
    .filter((t) => t.symbol.endsWith("USDT") && !t.symbol.includes("_"))
    .map((t) => {
      const price = parseFloat(t.lastPrice);
      const high = parseFloat(t.highPrice);
      const low = parseFloat(t.lowPrice);
      const bid = parseFloat(t.bidPrice || t.lastPrice);
      const ask = parseFloat(t.askPrice || t.lastPrice);
      const spread = price > 0 ? ((ask - bid) / price) * 100 : 0;
      const volatility = price > 0 ? ((high - low) / price) * 100 : 0;
      return {
        symbol: t.symbol,
        price,
        change24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.volume),
        quoteVolume24h: parseFloat(t.quoteVolume),
        high24h: high,
        low24h: low,
        spread: Math.max(0, spread),
        volatility,
      };
    })
    .filter((t) => t.quoteVolume24h > 500_000 && t.price > 0);
}

async function fetchWithFallback<T>(
  apiPath: string,
  directFn: () => Promise<T>,
  extract: (json: unknown) => T
): Promise<T> {
  try {
    const res = await fetch(apiPath, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.provider) activeProvider = json.provider;
      return extract(json);
    }
    // 451 or other error — try direct from browser
    if (res.status === 451 || res.status === 502) {
      console.warn(`API ${apiPath} returned ${res.status}, trying direct fetch…`);
      const result = await directFn();
      activeProvider = "client_direct";
      return result;
    }
    throw new Error(`API ${apiPath} failed: ${res.status}`);
  } catch {
    const result = await directFn();
    activeProvider = "client_direct";
    return result;
  }
}

export async function fetchTopFuturesTickers(limit = 100): Promise<MarketTicker[]> {
  const data = await fetchWithFallback(
    `${BASE}/tickers`,
    async () => {
      const { data: tickers, provider } = await fetchTickersClientDirect();
      activeProvider = provider;
      return tickers;
    },
    (json: unknown) => {
      const j = json as { tickers?: RawTicker[]; provider?: string };
      if (j.provider) activeProvider = j.provider;
      return j.tickers ?? (json as RawTicker[]);
    }
  );

  return mapTickers(data)
    .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
    .slice(0, limit);
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 100
): Promise<Candle[]> {
  const url = `${BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;

  return fetchWithFallback(
    url,
    () => fetchKlinesClientDirect(symbol, interval, limit),
    (json: unknown) => {
      const j = json as { candles?: Candle[] };
      if (Array.isArray(json) && json.length > 0 && Array.isArray((json as Candle[])[0])) {
        return (json as (string | number)[][]).map((k) => ({
          openTime: Number(k[0]),
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
          volume: parseFloat(String(k[5])),
        }));
      }
      return j.candles ?? [];
    }
  );
}

export interface MarketContext {
  fundingRate?: number;
  markPrice?: number;
  indexPrice?: number;
  openInterest?: number;
  prevOpenInterest?: number;
}

export async function fetchMarketContext(symbol: string): Promise<MarketContext> {
  try {
    const res = await fetch(`${BASE}/market?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch { /* ignore */ }
  return {};
}

const TF_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h",
};

export function intervalFor(tf: string): string {
  return TF_MAP[tf] ?? "15m";
}
