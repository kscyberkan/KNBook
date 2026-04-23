-- CreateTable
CREATE TABLE "AdminLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);
