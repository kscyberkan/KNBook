-- CreateTable
CREATE TABLE "ProfileImageHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "oldUrl" TEXT,
    "newUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileImageHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProfileImageHistory" ADD CONSTRAINT "ProfileImageHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
