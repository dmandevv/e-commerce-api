-- AlterTable
ALTER TABLE "payments" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]';
