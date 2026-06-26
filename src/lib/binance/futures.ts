import type { Candle, MarketTicker } from "@/types/trading";
import {
  fetchTickersClientDirect,
  fetchKlinesClientDirect,
  normalizeTickersPayload,
  type RawTicker,
} from "@/lib/binance/providers";

const BASE = "/api/binance";
let activeProvider = "unknown";

export function getActiveProvider() {
  return activeProvider;
}

function mapTickers(data: RawTicker[]): MarketTicker[] {
  if (!Array.isArray(data)) {
    throw new Error(`Expected ticker array, got ${typeof data}`);
  }

  return data
    .filter((t) => t?.symbol?.endsWith("USDT") && !t.symbol.includes("_"))
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

function normalizeCandlesPayload(json: unknown): Candle[] {
  if (Array.isArray(json)) {
    if (json.length > 0 && Array.isArray(json[0])) {
      return (json as (string | number)[][]).map((k) => ({
        openTime: Number(k[0]),
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
      }));
    }
    if (json.length > 0 && typeof json[0] === "object" && json[0] !== null && "open" in json[0]) {
      return json as Candle[];
    }
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.candles)) return obj.candles as Candle[];
    if (Array.isArray(obj.data)) return normalizeCandlesPayload(obj.data);
  }

  return [];
}

async function fetchWithFallback<T>(
  apiPath: string,
  directFn: () => Promise<T>,
  extract: (json: unknown) => T,
  validate: (value: T) => boolean
): Promise<T> {
  try {
    const res = await fetch(apiPath, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const result = extract(json);
      if (validate(result)) return result;
      console.warn(`API ${apiPath} returned invalid payload, trying direct fetch…`, json);
    } else if (res.status === 451 || res.status === 502) {
      console.warn(`API ${apiPath} returned ${res.status}, trying direct fetch…`);
    } else {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${apiPath} failed: ${res.status} ${body.slice(0, 120)}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("API ")) throw err;
    console.warn(`API ${apiPath} unreachable, trying direct fetch…`, err);
  }

  const result = await directFn();
  activeProvider = "client_direct";
  if (!validate(result)) {
    throw new Error(`Direct fetch returned invalid payload for ${apiPath}`);
  }
  return result;
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
      const obj = json as { provider?: string };
      if (obj.provider) activeProvider = obj.provider;
      return normalizeTickersPayload(json);
    },
    (value): value is RawTicker[] => Array.isArray(value)
  );

  if (!data.length) {
    throw new Error("No tickers returned — all market data providers failed");
  }

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
    (json: unknown) => normalizeCandlesPayload(json),
    (value): value is Candle[] => Array.isArray(value)
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
  "45m": "15m", "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h",
};

export async function fetchLivePrices(symbols: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(symbols)];
  const map: Record<string, number> = {};

  await Promise.allSettled(
    unique.map(async (symbol) => {
      const kl = await fetchKlines(symbol, "1m", 2);
      if (kl.length) map[symbol] = kl[kl.length - 1].close;
    })
  );

  return map;
}

export function intervalFor(tf: string): string {
  return TF_MAP[tf] ?? "15m";
}
