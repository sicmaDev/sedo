-- CreateTable
CREATE TABLE "SectorSheet" (
    "id" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actors" TEXT NOT NULL,
    "marketPrices" TEXT NOT NULL,
    "trends" TEXT NOT NULL,
    "regulation" TEXT NOT NULL,
    "tips" TEXT NOT NULL,
    "audioFile" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectorSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectorSheet_sector_key" ON "SectorSheet"("sector");
