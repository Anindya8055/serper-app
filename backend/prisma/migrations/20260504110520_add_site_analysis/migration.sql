-- CreateTable
CREATE TABLE "SiteAnalysis" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "homepageUrl" TEXT,
    "classifierVersion" TEXT NOT NULL,
    "fetchMethod" TEXT,
    "siteType" TEXT,
    "contentType" TEXT,
    "confidence" TEXT,
    "topScore" DOUBLE PRECISION,
    "secondScore" DOUBLE PRECISION,
    "scoreGap" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "pageSignals" JSONB NOT NULL,
    "pageResults" JSONB,
    "scores" JSONB,
    "matchedSignals" JSONB,
    "pageClassifications" JSONB,
    "analyzedPages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteAnalysis_url_key" ON "SiteAnalysis"("url");

-- CreateIndex
CREATE INDEX "SiteAnalysis_domain_idx" ON "SiteAnalysis"("domain");

-- CreateIndex
CREATE INDEX "SiteAnalysis_classifierVersion_idx" ON "SiteAnalysis"("classifierVersion");

-- CreateIndex
CREATE INDEX "SiteAnalysis_siteType_idx" ON "SiteAnalysis"("siteType");

-- CreateIndex
CREATE INDEX "SiteAnalysis_contentType_idx" ON "SiteAnalysis"("contentType");

-- CreateIndex
CREATE INDEX "SiteAnalysis_confidence_idx" ON "SiteAnalysis"("confidence");
