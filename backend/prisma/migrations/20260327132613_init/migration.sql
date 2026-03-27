-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'mpme',
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MPMEProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Cotonou, Bénin',
    "employees" INTEGER NOT NULL DEFAULT 1,
    "createdYear" INTEGER NOT NULL,
    "ifuStatus" TEXT NOT NULL DEFAULT 'Non démarré',
    "rccmStatus" TEXT NOT NULL DEFAULT 'Non démarré',
    "npiStatus" TEXT NOT NULL DEFAULT 'Non démarré',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MPMEProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "mpmeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'autre',
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "mpmeId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "mobileMoney" DOUBLE PRECISION NOT NULL,
    "comptabilite" DOUBLE PRECISION NOT NULL,
    "formalisation" DOUBLE PRECISION NOT NULL,
    "profilSectoriel" DOUBLE PRECISION NOT NULL,
    "recommendation" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '?',
    "subtitle" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION,
    "duration" TEXT,
    "offerType" TEXT NOT NULL DEFAULT 'credit',
    "sector" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancingOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IMFProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IMFProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MPMEProfile_userId_key" ON "MPMEProfile"("userId");

-- CreateIndex
CREATE INDEX "Transaction_mpmeId_date_idx" ON "Transaction"("mpmeId", "date");

-- CreateIndex
CREATE INDEX "Score_mpmeId_calculatedAt_idx" ON "Score"("mpmeId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IMFProfile_userId_key" ON "IMFProfile"("userId");

-- AddForeignKey
ALTER TABLE "MPMEProfile" ADD CONSTRAINT "MPMEProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_mpmeId_fkey" FOREIGN KEY ("mpmeId") REFERENCES "MPMEProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_mpmeId_fkey" FOREIGN KEY ("mpmeId") REFERENCES "MPMEProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IMFProfile" ADD CONSTRAINT "IMFProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
