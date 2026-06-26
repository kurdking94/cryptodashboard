# Futures Bot — Auto Scanner

Automatic Binance USDT perpetual futures scanner with multi-strategy confidence scoring, paper trading, and risk controls.

## Features

- **Auto Scanner** — scans top 100 futures pairs every 45s (deep analysis on top 40 by volume)
- **6 Strategies** — EMA Crossover, RSI, MACD, Volume Breakout, Bollinger, Trend Alignment
- **Confidence Score** — combines strategy agreement, volume, whale activity, news risk filter
- **Multi-Timeframe** — 5m / 15m / 1h / 4h trend alignment
- **Paper Trading** — auto-opens top signals, TP/SL, liquidation tracking
- **Auto-Replacement Queue** — fills slots when trades close
- **Risk Controls** — max leverage, position sizing, daily loss limit, kill switch
- **6 Dashboard Pages** — Overview, Scanner, Strategy Lab, Trades, Risk, Logs

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How to use

1. Open the dashboard
2. Click **Scan Now** to run a manual scan, or **Start Bot** for automatic scanning every 45s
3. View ranked signals on the **Scanner** page
4. In **PAPER** mode, the bot auto-opens up to 5 positions from top-confidence signals
5. Adjust risk settings on the **Risk** page
6. Monitor trades on **Trades** page

## Important

This is a **paper trading** system. LIVE mode requires exchange API keys (not yet connected).
No win rate is guaranteed — always backtest before using real capital.
