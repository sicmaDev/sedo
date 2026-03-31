-- CreateTable
CREATE TABLE "SectorNews" (
    "id" TEXT NOT NULL,
    "sector" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectorNews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectorNews_sector_publishedAt_idx" ON "SectorNews"("sector", "publishedAt");
