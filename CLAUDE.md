# Crypto Trading Bot Dashboard

## Dev Commands
```bash
npm run dev          # Start Next.js + WebSocket server concurrently
npm run dev:next     # Next.js only
npm run dev:server   # WebSocket sidecar only
npm run build        # Production build
npm run db:migrate   # Apply schema migrations
npm run db:generate  # Regenerate Prisma client
npm run db:studio    # Open Prisma Studio
```

## Architecture
- **Next.js 16** (App Router) at `app/` — frontend + API routes
- **WebSocket sidecar** at `server/` — real-time market data + strategy runner
- **Prisma v7 + SQLite** via libsql adapter — persistent storage
- **ccxt** — exchange connectivity (server-side only, never in browser)
- **lightweight-charts v5** — candlestick price charts (uses `addSeries(CandlestickSeries, ...)` API)
- **React 19** + TanStack Query — data fetching + state management
- **Zustand** — client-side state (selected exchange, symbol, etc.)
- **Radix UI + Tailwind CSS** — component framework

## Database Schema
8 Prisma models:
- **ExchangeConfig** — API credentials + sandbox flag per exchange
- **Strategy** — Strategy instances with type, symbol, timeframe, config (JSON), status
- **Trade** — Executed trades linked to strategies/exchanges/orders
- **BacktestResult** — Win rate, Sharpe ratio, max drawdown, profit factor, equity curve
- **SystemLog** — Structured logging (level, source, message, metadata)
- **ModelMemory** — Persisted neural pattern memories per symbol/timeframe
- **RiskProfile** — Global risk settings (max position %, drawdown %, stop loss %, take profit %, max open positions)

## Implemented Strategies (8 total)

### Traditional
- **MA_CROSSOVER** — SMA/EMA fast vs slow crossover
- **RSI** — Oversold/overbought threshold signals
- **MACD** — Histogram-based signals
- **BOLLINGER** — Bounce off upper/lower bands
- **GRID** — Programmatic buy/sell at fixed grid levels

### ML-Enhanced
- **POWER_TRADER** — Neural DCA with 7-stage configurable entries, news sentiment blocking, trailing profit margin, InstancePredictor signal injection
- **DAY_TRADER** — Intraday with hard stop/TP, trailing stop activation, 5-trade daily cap, neural early exit, sentiment blocking
- **SENTIMENT** — Fear & Greed Index + RSI hybrid; extreme fear → panic buy, extreme greed → bubble exit

## ML / Neural Features
- **InstancePredictor** (`lib/ml/InstancePredictor.ts`) — Pattern-based price level prediction; aggregates signals across 1h/4h/1d timeframes; returns 7 long + 7 short predicted levels; persists to ModelMemory
- **PatternMemory** (`lib/ml/PatternMemory.ts`) — Builds from historical OHLCV candles; predicts high/low % changes with minimum gap spacing enforcement

## News & Sentiment
**NewsSentimentScorer** (`lib/news/NewsSentimentScorer.ts`) — 4 weighted sources:
1. CryptoPanic (3x) — pre-labelled posts
2. Stocktwits (2x) — Bullish/Bearish tagged messages
3. Reddit (1.5x) — keyword-scored titles from crypto subreddits
4. CryptoCompare News (1x) — general news filtered by symbol

Features: recency weighting, 15-min server cache, returns score (-1 to +1), label, confidence, top 10 headlines, source breakdown.

**Fear & Greed Index** — CoinGecko endpoint, cached 1 hour, used by SentimentStrategy.

## Key Notes
- All API keys encrypted before DB storage (`lib/encryption.ts`); legacy plaintext migration supported
- `prisma/schema.prisma` must NOT have `url` in datasource (Prisma v7 uses `prisma.config.ts`)
- All API routes have `export const dynamic = 'force-dynamic'`
- Exchange adapters are cached per-exchange in `lib/exchange/ExchangeFactory.ts`
- Strategies run on polling intervals (not WebSocket) in `lib/strategies/StrategyRunner.ts`
- StrategyRunner auto-injects neural signals + news sentiment before each candle for POWER_TRADER/DAY_TRADER
- Risk enforcement via `lib/risk/RiskManager.ts` (position sizing, max drawdown, trade cap)
- Structured logging to SystemLog table via `lib/logger.ts`

## API Routes (25 total)
- `GET/POST /api/strategies` — list / create
- `GET /api/strategies/[id]` — details
- `POST /api/strategies/[id]/start|stop|toggle` — lifecycle
- `POST /api/strategies/seed` — seed demo strategies
- `POST /api/backtest` — run backtest
- `GET/POST /api/exchanges` — list / create
- `GET /api/exchanges/[id]/balance|markets|ohlcv` — exchange data
- `GET /api/exchanges/[id]/ticker/[symbol]` — current ticker
- `GET/POST /api/dca-bot` — DCA bot status / start/stop
- `GET/POST /api/orders`, `GET /api/orders/[id]` — orders
- `GET /api/trades` — trade history
- `POST /api/ml/train`, `GET /api/ml/signals`, `GET /api/ml/predict` — ML endpoints
- `GET /api/sentiment`, `POST /api/news/sentiment` — sentiment
- `GET /api/trending` — trending coins
- `GET /api/analytics` — portfolio analytics
- `GET /api/logs` — system logs

## Pages (12 total)
Dashboard, Strategies, Backtesting, DCA Bot, Trading, History, Trending, Logs, Settings, Root, Main Layout, Dashboard Layout

## Adding a New Strategy
1. Create `lib/strategies/implementations/MyStrategy.ts` extending `BaseStrategy`
2. Register it in `lib/strategies/StrategyRegistry.ts`
3. Add default params to `STRATEGY_DEFAULTS` in `components/strategies/StrategyForm.tsx`
4. Add display name to `STRATEGY_TYPES` in `lib/constants.ts`

## Supported Exchanges
Binance, Coinbase Pro, Kraken, Bybit, OKX
