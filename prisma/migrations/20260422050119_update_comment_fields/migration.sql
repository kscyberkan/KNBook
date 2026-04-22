-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "replyToId" INTEGER,
ADD COLUMN     "stickerUrl" TEXT,
ALTER COLUMN "text" DROP NOT NULL;
