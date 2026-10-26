-- Remove the classification columns introduced by migration 005.
ALTER TABLE settlements DROP COLUMN execution_mode;
ALTER TABLE refunds DROP COLUMN verification_mode;
