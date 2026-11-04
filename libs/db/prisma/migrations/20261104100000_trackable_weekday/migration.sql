-- Weekly trackables can show their log on a chosen weekday.
ALTER TABLE "Trackable" ADD COLUMN "weekday" SMALLINT;
ALTER TABLE "Trackable" ADD CONSTRAINT "Trackable_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);
