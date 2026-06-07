"use client";

import { useEffect, useRef, useState } from "react";

export interface TickerData {
  symbol: string;
  price: number;
  priceChange24h: number; // percent
}

type PriceMap = Record<string, TickerData>;

const WS_BASE = "wss://stream.binance.com:9443/stream?streams=";

/**
 * Opens a Binance combined-stream WebSocket for the given symbols and
 * keeps a live PriceMap updated. The WebSocket is torn down and
 * re-established whenever the symbol list changes.
 */
export function useBinancePriceFeed(symbols: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>({});
  const attemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);

  // symbols is captured directly in the effect closure — it's correct for
  // the lifetime of this particular WS instance. When the symbol list changes,
  // the effect reruns, tears down the current WS, and opens a new one.
  useEffect(() => {
    mountedRef.current = true;
    attemptsRef.current = 0;

    function connect() {
      if (!symbols.length) return;

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }

      const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
      const ws = new WebSocket(WS_BASE + streams);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          const d = msg.data ?? msg;
          const symbol: string = d.s;
          const price = parseFloat(d.c);
          const priceChange24h = parseFloat(d.P);
          if (!symbol || isNaN(price)) return;
          setPrices((prev) => ({
            ...prev,
            [symbol]: { symbol, price, priceChange24h },
          }));
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        const delay = Math.min(1000 * 2 ** attemptsRef.current, 30_000);
        attemptsRef.current += 1;
        setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return prices;
}
