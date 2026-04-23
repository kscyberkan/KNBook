-- AlterTable
ALTER TABLE "AdminLog" ADD COLUMN     "postId" INTEGER;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
