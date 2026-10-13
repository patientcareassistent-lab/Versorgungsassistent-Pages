-- R2-Originalvorlagen: ausschließlich Formularmetadaten ohne Patientenbezug.
-- In Supabase am 13.10.2026 angewendet. Migrationsdatei zum reproduzierbaren Nachvollzug.
create table if not exists app_private.formular_vorlagen_r2 (
  formular_id text not null,
  version text not null,
  kostentraeger text not null,
  produktgruppe text not null,
  dokumenttyp text not null default 'massblatt',
  vertragskennung text,
  quelle_archiv text not null,
  quelle_datei text not null,
  r2_bucket text not null,
  r2_key text not null,
  dateityp text not null,
  dateigroesse integer not null check (dateigroesse > 0),
  sha256 char(64) not null check (sha256 ~ '^[a-f0-9]{64}$'),
  seiten integer,
  widget_anzahl integer,
  status text not null default 'staged' check (status in ('staged','uploaded','verified','active','retired')),
  r2_verified_at timestamptz,
  feldmapping_geprueft boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (formular_id,version),
  unique (r2_bucket,r2_key),
  constraint no_unverified_activation check (
    status not in ('verified','active') or (r2_verified_at is not null and feldmapping_geprueft)
  )
);
alter table app_private.formular_vorlagen_r2 enable row level security;
revoke all on app_private.formular_vorlagen_r2 from public, anon, authenticated;
comment on table app_private.formular_vorlagen_r2 is
  'Dokument- und SHA256-Register ohne Personenbezug: R2 Originalformulare und Freigabestand. Kein patientenbezogenes PDF.';
