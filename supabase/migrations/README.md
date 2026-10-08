# Supabase migrations

This directory mirrors security-relevant migrations that are already applied to the live Supabase project.

The numeric prefixes are the exact remote migration versions. Keeping them in the repository lets future audits and Supabase CLI reconciliation compare the deployed database with source control without generating duplicate migration versions.

Older project migrations predate this source-controlled migration folder and remain in the Supabase migration history. New security- and schema-relevant migrations should be committed here using the exact version returned by Supabase.
