-- CreateTable
CREATE TABLE "Search" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "searchId" INTEGER NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Search_keyword_key" ON "Search"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "Result_searchId_url_key" ON "Result"("searchId", "url");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
