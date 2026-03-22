-- CreateTable
CREATE TABLE "ModelMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "memoryJson" TEXT NOT NULL,
    "candleCount" INTEGER NOT NULL,
    "trainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelMemory_symbol_timeframe_key" ON "ModelMemory"("symbol", "timeframe");
