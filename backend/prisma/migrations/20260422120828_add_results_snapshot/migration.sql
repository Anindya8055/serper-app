/*
  Warnings:

  - You are about to drop the `Result` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `resultsSnapshot` to the `Search` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Search` table without a default value. This is not possible if the table is not empty.
  - Made the column `country` on table `Search` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_searchId_fkey";

-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "resultsSnapshot" JSONB NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "country" SET NOT NULL;

-- DropTable
DROP TABLE "Result";
