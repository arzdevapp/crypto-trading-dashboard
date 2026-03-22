import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

type AppState = ExchangeState & TradingState & UIState;

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
      }),
    }
  )
);
