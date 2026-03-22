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

## Key Notes
- All API keys are stored in DB (not encrypted yet — add encryption for production)
- `prisma/schema.prisma` must NOT have `url` in datasource (Prisma v7 uses `prisma.config.ts`)
- All API routes have `export const dynamic = 'force-dynamic'`
- Exchange adapters are cached per-exchange in `lib/exchange/ExchangeFactory.ts`
- Strategies run on polling intervals (not WebSocket) in `lib/strategies/StrategyRunner.ts`

## Adding a New Strategy
1. Create `lib/strategies/implementations/MyStrategy.ts` extending `BaseStrategy`
2. Register it in `lib/strategies/StrategyRegistry.ts`
3. Add default params to `STRATEGY_DEFAULTS` in `components/strategies/StrategyForm.tsx`
4. Add display name to `STRATEGY_TYPES` in `lib/constants.ts`
