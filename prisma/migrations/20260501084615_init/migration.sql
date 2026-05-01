-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "groupName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'th';
