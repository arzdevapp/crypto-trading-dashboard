import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../lib/db';
import { startStrategy, stopStrategy } from '../lib/strategies/StrategyRunner';

let bot: TelegramBot | null = null;
let chatId: string | null = null;

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set — Telegram bot disabled');
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  chatId = process.env.TELEGRAM_CHAT_ID ?? null;

  bot.onText(/\/start/, (msg) => {
    const id = String(msg.chat.id);
    chatId = id;
    console.log(`[telegram] Chat ID: ${id} — save this as TELEGRAM_CHAT_ID in .env`);
    bot!.sendMessage(id,
      `🤖 *Crypto Bot connected!*\n\nYour chat ID: \`${id}\`\nAdd to \.env: \`TELEGRAM_CHAT_ID=${id}\`\n\nType /help for commands\.`,
      { parse_mode: 'MarkdownV2' }
    );
  });

  bot.onText(/\/help/, (msg) => {
    const id = String(msg.chat.id);
    bot!.sendMessage(id,
      `*Commands*\n\n` +
      `/status — all strategies status\n` +
      `/positions — open positions & P&L\n` +
      `/stopbot <name> — stop a strategy\n` +
      `/startbot <id> — start a strategy by ID\n` +
      `/list — list all strategies with IDs\n` +
      `/help — show this message`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/status/, async (msg) => {
    const id = String(msg.chat.id);
    try {
      const strategies = await prisma.strategy.findMany({
        orderBy: { createdAt: 'asc' },
      });
      if (strategies.length === 0) {
        bot!.sendMessage(id, 'No strategies found.');
        return;
      }
      const lines = strategies.map(s => {
        const icon = s.status === 'running' ? '🟢' : s.status === 'error' ? '🔴' : '⚫';
        return `${icon} *${s.name}* — ${s.symbol} (${s.timeframe})\n   Status: ${s.status}`;
      });
      bot!.sendMessage(id, lines.join('\n\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      bot!.sendMessage(id, `Error: ${err}`);
    }
  });

  bot.onText(/\/list/, async (msg) => {
    const id = String(msg.chat.id);
    try {
      const strategies = await prisma.strategy.findMany({ orderBy: { createdAt: 'asc' } });
      if (strategies.length === 0) {
        bot!.sendMessage(id, 'No strategies found.');
        return;
      }
      const lines = strategies.map(s =>
        `*${s.name}*\nID: \`${s.id}\`\nSymbol: ${s.symbol} | Status: ${s.status}`
      );
      bot!.sendMessage(id, lines.join('\n\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      bot!.sendMessage(id, `Error: ${err}`);
    }
  });

  bot.onText(/\/positions/, async (msg) => {
    const id = String(msg.chat.id);
    try {
      const strategies = await prisma.strategy.findMany({ where: { status: 'running' } });
      const inPosition = strategies.filter(s => {
        try {
          const config = JSON.parse(s.config);
          return config._savedState?.inPosition === true;
        } catch { return false; }
      });

      if (inPosition.length === 0) {
        bot!.sendMessage(id, '📭 No open positions.');
        return;
      }

      const lines = inPosition.map(s => {
        const config = JSON.parse(s.config);
        const state = config._savedState ?? {};
        const size = state.positionSize ? Number(state.positionSize).toFixed(6) : '?';
        const avg = state.avgCostBasis ? `$${Number(state.avgCostBasis).toFixed(2)}` : '?';
        const stage = state.dcaStage ?? '?';
        return `📌 *${s.name}* — ${s.symbol}\nSize: ${size} | Avg: ${avg} | DCA Stage: ${stage}/7`;
      });

      bot!.sendMessage(id, lines.join('\n\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      bot!.sendMessage(id, `Error: ${err}`);
    }
  });

  bot.onText(/\/stopbot (.+)/, async (msg, match) => {
    const id = String(msg.chat.id);
    const nameOrId = match?.[1]?.trim();
    if (!nameOrId) {
      bot!.sendMessage(id, 'Usage: /stopbot <strategy name or ID>');
      return;
    }
    try {
      const strategy = await prisma.strategy.findFirst({
        where: { OR: [{ id: nameOrId }, { name: { contains: nameOrId } }] },
      });
      if (!strategy) {
        bot!.sendMessage(id, `Strategy "${nameOrId}" not found.`);
        return;
      }
      await stopStrategy(strategy.id);
      bot!.sendMessage(id, `⏹ *${strategy.name}* stopped.`, { parse_mode: 'Markdown' });
    } catch (err) {
      bot!.sendMessage(id, `Error: ${err}`);
    }
  });

  bot.onText(/\/startbot (.+)/, async (msg, match) => {
    const id = String(msg.chat.id);
    const strategyId = match?.[1]?.trim();
    if (!strategyId) {
      bot!.sendMessage(id, 'Usage: /startbot <strategy ID> (use /list to see IDs)');
      return;
    }
    try {
      await startStrategy(strategyId);
      const strategy = await prisma.strategy.findUnique({ where: { id: strategyId } });
      bot!.sendMessage(id, `▶️ *${strategy?.name ?? strategyId}* started.`, { parse_mode: 'Markdown' });
    } catch (err) {
      bot!.sendMessage(id, `Error: ${err}`);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('[telegram] Polling error:', err.message);
  });

  console.log('[telegram] Bot started' + (chatId ? ` (chat ID: ${chatId})` : ' — send /start to your bot to register chat ID'));
}

/** Send a trade notification (buy/sell executed) */
export function notifyTrade(strategyName: string, symbol: string, action: 'buy' | 'sell', amount: number, price: number) {
  if (!bot || !chatId) return;
  const icon = action === 'buy' ? '🟢' : '🔴';
  const verb = action === 'buy' ? 'BUY' : 'SELL';
  const msg =
    `${icon} *${verb} executed*\n` +
    `Strategy: ${strategyName}\n` +
    `Pair: ${symbol}\n` +
    `Amount: ${amount.toFixed(6)}\n` +
    `Price: $${price.toFixed(2)}`;
  bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(() => {});
}

/** Send a strategy error notification */
export function notifyError(strategyName: string, symbol: string, error: string) {
  if (!bot || !chatId) return;
  bot.sendMessage(chatId,
    `🔴 *Strategy Error*\n${strategyName} — ${symbol}\n\`${error}\``,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
}

/** Send a strategy stopped notification */
export function notifyStopped(strategyName: string, symbol: string) {
  if (!bot || !chatId) return;
  bot.sendMessage(chatId,
    `⏹ *Strategy stopped*\n${strategyName} — ${symbol}`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});
}

/** Send a custom message (e.g. server boot) */
export function notifyMessage(text: string) {
  if (!bot || !chatId) return;
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
}
