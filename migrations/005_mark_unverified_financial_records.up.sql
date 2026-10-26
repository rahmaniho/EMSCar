-- Historical refunds/settlements predate provider verification and administrator attestations.
-- Keep those records visible, but exclude them from verified financial totals unless explicitly classified.
ALTER TABLE refunds
  ADD COLUMN verification_mode TEXT NOT NULL DEFAULT 'legacy_unverified'
  CHECK (verification_mode IN ('legacy_unverified', 'sandbox_simulated', 'provider_verified'));

ALTER TABLE settlements
  ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'legacy_unverified'
  CHECK (execution_mode IN ('legacy_unverified', 'sandbox_simulated', 'manual_external'));
