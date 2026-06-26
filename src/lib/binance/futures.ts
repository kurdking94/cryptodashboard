import type { Candle, MarketTicker } from "@/types/trading";

const BASE = "/api/binance";

export async function fetchTopFuturesTickers(limit = 100): Promise<MarketTicker[]> {
  const res = await fetch(`${BASE}/tickers`);
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  const data = (await res.json()) as Array<Record<string, string>>;

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
    .filter((t) => t.quoteVolume24h > 1_000_000 && t.price > 0)
    .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
    .slice(0, limit);
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 100
): Promise<Candle[]> {
  const url = `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klines error ${symbol}: ${res.status}`);
  const data = (await res.json()) as Array<(string | number)[]>;
  return data.map((k) => ({
    openTime: Number(k[0]),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }));
}

const TF_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
};

export function intervalFor(tf: string): string {
  return TF_MAP[tf] ?? "15m";
}
