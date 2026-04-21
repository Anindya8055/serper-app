/*
  Warnings:

  - A unique constraint covering the columns `[keyword,country]` on the table `Search` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_searchId_fkey";

-- DropIndex
DROP INDEX "Search_keyword_key";

-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "country" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Search_keyword_country_key" ON "Search"("keyword", "country");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;
