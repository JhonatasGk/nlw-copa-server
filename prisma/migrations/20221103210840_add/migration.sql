/*
  Warnings:

  - A unique constraint covering the columns `[gameId,participantId]` on the table `guesses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "guesses_gameId_participantId_key" ON "guesses"("gameId", "participantId");
