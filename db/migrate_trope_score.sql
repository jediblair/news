-- Migration: add trope_score column to articles
-- Run this once against a running database (init.sql already includes it for fresh setups).

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS trope_score SMALLINT CHECK (trope_score BETWEEN 0 AND 100);
