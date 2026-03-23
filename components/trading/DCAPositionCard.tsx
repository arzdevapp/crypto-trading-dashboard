'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency, formatPercent, formatCrypto } from '@/lib/utils';
import { useState } from 'react';

export interface DCAPosition {
  symbol: string;
  avgCostBasis: number;
  currentPrice: number;
  positionSize: number;
  dcaStage: number;
  dcaTotal: number;
  trailingPMLine: number;
  pmActive: boolean;
  neuralLongLevel: number;
  neuralShortLevel: number;
}

export function DCAPositionCard({ position }: { position: DCAPosition }) {
  const [adjustedPositionSize, setAdjustedPositionSize] = useState(position.positionSize);
  
  // Calculate P&L based on adjusted position size
  const pnl = (position.currentPrice - position.avgCostBasis) * adjustedPositionSize;
  const pnlPct = position.avgCostBasis > 0
    ? ((position.currentPrice - position.avgCostBasis) / position.avgCostBasis) * 100
    : 0;
  const isProfit = pnl >= 0;

  return (
    <Card className="overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isProfit ? 'bg-green-500' : 'bg-red-500'}`} />
      <CardHeader className="pl-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">{position.symbol}</CardTitle>
          <div className="flex items-center gap-1.5">
            {isProfit ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
            <span className={`text-sm font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercent(pnlPct)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-4 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-muted-foreground">Avg Cost</div>
          <div className="font-mono text-right">{formatCurrency(position.avgCostBasis)}</div>
          <div className="text-muted-foreground">Current Price</div>
          <div className="font-mono text-right">{formatCurrency(position.currentPrice)}</div>
          <div className="text-muted-foreground">Size</div>
          <div className="font-mono text-right">{formatCrypto(adjustedPositionSize, 6)}</div>
          <div className="text-muted-foreground">Unrealized P&L</div>
          <div className={`font-mono text-right font-medium ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
            {formatCurrency(pnl)}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">DCA Progress</span>
            <span>{position.dcaStage}/{position.dcaTotal}</span>
          </div>
          <Progress value={(position.dcaStage / position.dcaTotal) * 100} className="h-1.5" />
        </div>

        {position.pmActive && (
          <div className="flex items-center justify-between text-xs bg-green-500/10 rounded px-2 py-1">
            <span className="text-green-400">Trailing PM Active</span>
            <span className="font-mono text-green-400">{formatCurrency(position.trailingPMLine)}</span>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">LONG</span>
            <Badge variant="outline" className="text-[10px] py-0 text-blue-400 border-blue-400/30">N{position.neuralLongLevel}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">SHORT</span>
            <Badge variant="outline" className="text-[10px] py-0 text-orange-400 border-orange-400/30">N{position.neuralShortLevel}</Badge>
          </div>
        </div>
        
        {/* Position Size Slider */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Adjust Position Size</span>
            <span className="font-mono">{formatCrypto(adjustedPositionSize, 6)}</span>
          </div>
          <Slider
            min={0.001}
            max={position.positionSize * 3} // Allow up to 3x original size
            step={0.001}
            value={[adjustedPositionSize]}
            onValueChange={([value]) => setAdjustedPositionSize(value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
