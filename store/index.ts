import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveIndicators {
  ema9?: boolean;
  ema21?: boolean;
  sma50?: boolean;
  sma200?: boolean;
  bollinger?: boolean;
}

interface ExchangeState {
  activeExchangeId: string | null;
  setActiveExchangeId: (id: string | null) => void;
}

interface TradingState {
  selectedSymbol: string;
  selectedTimeframe: string;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;
}

interface ChartState {
  activeIndicators: ActiveIndicators;
  setActiveIndicators: (indicators: ActiveIndicators) => void;
  toggleIndicator: (key: keyof ActiveIndicators) => void;
}

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

type AppState = ExchangeState & TradingState & ChartState & UIState;

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Exchange
      activeExchangeId: null,
      setActiveExchangeId: (id) => set({ activeExchangeId: id }),

      // Trading
      selectedSymbol: 'BTC/USDT',
      selectedTimeframe: '1h',
      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),

      // Chart indicators
      activeIndicators: {},
      setActiveIndicators: (indicators) => set({ activeIndicators: indicators }),
      toggleIndicator: (key) => set((state) => ({
        activeIndicators: { ...state.activeIndicators, [key]: !state.activeIndicators[key] },
      })),

      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
    }),
    {
      name: 'crypto-trading-store',
      partialize: (state) => ({
        activeExchangeId: state.activeExchangeId,
        selectedSymbol: state.selectedSymbol,
        selectedTimeframe: state.selectedTimeframe,
        activeIndicators: state.activeIndicators,
      }),
    }
  )
);
