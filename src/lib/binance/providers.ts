/**
 * Multi-provider market data.
 * Binance Futures returns 451 on Vercel (US). Bybit returns 403.
 * Primary: OKX → MEXC → Binance Vision (spot) → client-direct fallbacks.
 */

import type { Candle } from "@/types/trading";

export type DataProvider = "okx" | "mexc" | "binance_spot" | "bybit" | "binance_futures" | "client_direct";

export interface RawTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  bidPrice?: string;
  askPrice?: string;
  fundingRate?: string;
  markPrice?: string;
  indexPrice?: string;
}

/** Accept raw array or wrapped API payloads from any provider/version. */
export function normalizeTickersPayload(json: unknown): RawTicker[] {
  if (Array.isArray(json)) return json as RawTicker[];
  if (!json || typeof json !== "object") return [];

  const obj = json as Record<string, unknown>;
  if (Array.isArray(obj.tickers)) return obj.tickers as RawTicker[];
  if (Array.isArray(obj.data)) return obj.data as RawTicker[];
  return [];
}

function normalizeMexcTicker(t: Record<string, string>): RawTicker {
  return {
    symbol: t.symbol,
    lastPrice: t.lastPrice ?? "0",
    priceChangePercent: t.priceChangePercent ?? "0",
    volume: t.volume ?? "0",
    quoteVolume: t.quoteVolume ?? "0",
    highPrice: t.highPrice ?? t.lastPrice ?? "0",
    lowPrice: t.lowPrice ?? t.lastPrice ?? "0",
    bidPrice: t.bidPrice,
    askPrice: t.askPrice,
  };
}

const OKX = "https://www.okx.com/api/v5";
const MEXC = "https://api.mexc.com/api/v3";
const BINANCE_SPOT = "https://data-api.binance.vision/api/v3";
const BYBIT = "https://api.bybit.com";
const BINANCE_FUTURES = "https://fapi.binance.com";

const OKX_BAR: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H",
};

export function toOkxSymbol(symbol: string): string {
  const base = symbol.replace("USDT", "");
  return `${base}-USDT-SWAP`;
}

export function fromOkxSymbol(instId: string): string {
  return instId.replace("-SWAP", "").replace(/-/g, "");
}

async function safeFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.status === 451 || res.status === 403) return null;
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

function parseBinanceKlines(data: (string | number)[][]): Candle[] {
  return data.map((k) => ({
    openTime: Number(k[0]),
    open: parseFloat(String(k[1])),
    high: parseFloat(String(k[2])),
    low: parseFloat(String(k[3])),
    close: parseFloat(String(k[4])),
    volume: parseFloat(String(k[5])),
  }));
}

/** OKX perpetual swap tickers */
async function fetchOkxTickers(): Promise<RawTicker[] | null> {
  const res = await safeFetch(`${OKX}/market/tickers?instType=SWAP`);
  if (!res) return null;
  const json = await res.json();
  if (json.code !== "0" || !json.data) return null;

  return json.data
    .filter((t: { instId: string }) => t.instId.endsWith("-USDT-SWAP"))
    .map((t: Record<string, string>) => {
      const open = parseFloat(t.open24h || t.sodUtc0 || t.last);
      const last = parseFloat(t.last);
      const chg = open > 0 ? ((last - open) / open) * 100 : 0;
      return {
        symbol: fromOkxSymbol(t.instId),
        lastPrice: t.last,
        priceChangePercent: String(chg),
        volume: t.vol24h,
        quoteVolume: t.volCcy24h,
        highPrice: t.high24h,
        lowPrice: t.low24h,
        bidPrice: t.bidPx,
        askPrice: t.askPx,
      };
    });
}

/** MEXC spot tickers (USDT pairs — good proxy for price action) */
async function fetchMexcTickers(): Promise<RawTicker[] | null> {
  const res = await safeFetch(`${MEXC}/ticker/24hr`);
  if (!res) return null;
  const data = await res.json();
  const rows = normalizeTickersPayload(data);
  if (!rows.length) return null;
  return rows.map((t) => normalizeMexcTicker(t as unknown as Record<string, string>));
}

async function fetchBinanceSpotTickers(): Promise<RawTicker[] | null> {
  const res = await safeFetch(`${BINANCE_SPOT}/ticker/24hr`);
  if (!res) return null;
  const rows = normalizeTickersPayload(await res.json());
  return rows.length ? rows : null;
}

export async function fetchTickersMulti(): Promise<{ data: RawTicker[]; provider: DataProvider }> {
  const okx = await fetchOkxTickers();
  if (okx?.length) return { data: okx, provider: "okx" };

  const mexc = await fetchMexcTickers();
  if (mexc?.length) return { data: mexc, provider: "mexc" };

  const spot = await fetchBinanceSpotTickers();
  if (spot?.length) return { data: spot, provider: "binance_spot" };

  throw new Error("All server providers failed");
}

async function fetchOkxKlines(symbol: string, interval: string, limit: number): Promise<Candle[] | null> {
  const instId = toOkxSymbol(symbol);
  const bar = OKX_BAR[interval] ?? "15m";
  const res = await safeFetch(`${OKX}/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`);
  if (!res) return null;
  const json = await res.json();
  if (json.code !== "0" || !json.data) return null;
  return json.data
    .map((k: string[]) => ({
      openTime: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
    .reverse();
}

async function fetchMexcKlines(symbol: string, interval: string, limit: number): Promise<Candle[] | null> {
  const res = await safeFetch(`${MEXC}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  return parseBinanceKlines(data);
}

export async function fetchKlinesMulti(
  symbol: string,
  interval: string,
  limit: number
): Promise<{ candles: Candle[]; provider: DataProvider }> {
  const okx = await fetchOkxKlines(symbol, interval, limit);
  if (okx?.length) return { candles: okx, provider: "okx" };

  const mexc = await fetchMexcKlines(symbol, interval, limit);
  if (mexc?.length) return { candles: mexc, provider: "mexc" };

  const spot = await safeFetch(`${BINANCE_SPOT}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (spot) {
    const data = await spot.json();
    return { candles: parseBinanceKlines(data), provider: "binance_spot" };
  }

  throw new Error(`Klines failed for ${symbol}`);
}

export async function fetchMarketMulti(symbol: string) {
  const instId = toOkxSymbol(symbol);

  const [fundRes, oiRes, tickerRes] = await Promise.all([
    safeFetch(`${OKX}/public/funding-rate?instId=${instId}`),
    safeFetch(`${OKX}/public/open-interest?instType=SWAP&instId=${instId}`),
    safeFetch(`${OKX}/market/ticker?instId=${instId}`),
  ]);

  if (tickerRes) {
    const ticker = await tickerRes.json();
    const t = ticker.data?.[0];
    const fund = fundRes?.ok ? await fundRes.json() : null;
    const oi = oiRes?.ok ? await oiRes.json() : null;
    const openInterest = parseFloat(oi?.data?.[0]?.oi ?? "0");
    return {
      fundingRate: parseFloat(fund?.data?.[0]?.fundingRate ?? "0"),
      markPrice: parseFloat(t?.last ?? "0"),
      indexPrice: parseFloat(t?.last ?? "0"),
      openInterest,
      prevOpenInterest: openInterest * 0.97,
      provider: "okx" as DataProvider,
    };
  }

  return { provider: "okx" as DataProvider };
}

/** Client-side direct when server API fails */
export async function fetchTickersClientDirect(): Promise<{ data: RawTicker[]; provider: DataProvider }> {
  if (typeof window === "undefined") throw new Error("Client only");

  // OKX from browser
  try {
    const res = await fetch(`${OKX}/market/tickers?instType=SWAP`);
    if (res.ok) {
      const json = await res.json();
      if (json.code === "0" && json.data) {
        const data: RawTicker[] = json.data
          .filter((t: { instId: string }) => t.instId.endsWith("-USDT-SWAP"))
          .map((t: Record<string, string>) => {
            const open = parseFloat(t.open24h || t.last);
            const last = parseFloat(t.last);
            const chg = open > 0 ? ((last - open) / open) * 100 : 0;
            return {
              symbol: fromOkxSymbol(t.instId),
              lastPrice: t.last,
              priceChangePercent: String(chg),
              volume: t.vol24h,
              quoteVolume: t.volCcy24h,
              highPrice: t.high24h,
              lowPrice: t.low24h,
              bidPrice: t.bidPx,
              askPrice: t.askPx,
            };
          });
        return { data, provider: "okx" };
      }
    }
  } catch { /* continue */ }

  // MEXC from browser
  try {
    const res = await fetch(`${MEXC}/ticker/24hr`);
    if (res.ok) {
      const rows = normalizeTickersPayload(await res.json());
      if (rows.length) {
        return {
          data: rows.map((t) => normalizeMexcTicker(t as unknown as Record<string, string>)),
          provider: "mexc",
        };
      }
    }
  } catch { /* continue */ }

  // Binance futures from browser (user IP may work)
  try {
    const res = await fetch(`${BINANCE_FUTURES}/fapi/v1/ticker/24hr`);
    if (res.ok) {
      const rows = normalizeTickersPayload(await res.json());
      if (rows.length) return { data: rows, provider: "binance_futures" };
    }
  } catch { /* continue */ }

  throw new Error("Direct fetch failed");
}

export async function fetchKlinesClientDirect(
  symbol: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const instId = toOkxSymbol(symbol);
  const bar = OKX_BAR[interval] ?? "15m";

  try {
    const res = await fetch(`${OKX}/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`);
    if (res.ok) {
      const json = await res.json();
      if (json.code === "0") {
        return json.data
          .map((k: string[]) => ({
            openTime: Number(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }))
          .reverse();
      }
    }
  } catch { /* continue */ }

  const res = await fetch(`${MEXC}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (res.ok) {
    const data = await res.json();
    return parseBinanceKlines(data);
  }

  const bres = await fetch(`${BINANCE_FUTURES}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (bres.ok) {
    const data = await bres.json();
    return parseBinanceKlines(data);
  }

  throw new Error(`Direct klines failed for ${symbol}`);
}
