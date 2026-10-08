-- Catalog only; manual database migration, NOT applied by GitHub Pages deployment.
-- Patient data and individual goals remain in protected care cases, never in public static assets.
create table if not exists app_private.versorgungsziele (
  id text primary key,
  pg text not null check (pg in ('23','24')),
  region text not null,
  versorgungsart text not null,
  zieltext text not null,
  quellenhinweis text not null,
  status text not null default 'REDAKTIONELL_GEPRUEFT' check (status in ('ENTWURF','REDAKTIONELL_GEPRUEFT','FREIGEGEBEN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_private.versorgungsziele enable row level security;
revoke all on app_private.versorgungsziele from public, anon, authenticated;
create index if not exists versorgungsziele_pg_region_art_idx on app_private.versorgungsziele(pg,region,versorgungsart);
insert into app_private.versorgungsziele(id,pg,region,versorgungsart,zieltext,quellenhinweis,status) values
  ('23-01','23','untere','alle','Stabilisierung und sichere Führung der betroffenen unteren Extremität','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-02','23','untere','alle','Verbesserung der Stand- und Gangsicherheit im individuellen Alltag','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-03','23','untere','alle','Kontrollierte Begrenzung unerwünschter Gelenkbewegungen bei Erhalt nutzbarer Beweglichkeit','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-04','23','untere','alle','Entlastung schmerzhafter oder strukturell gefährdeter Gelenk- und Gewebebereiche','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-05','23','obere','alle','Positionierung und Stabilisierung der betroffenen oberen Extremität','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-06','23','obere','alle','Verbesserung der Greif-, Halte- und Führungsfunktion im Alltag','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-07','23','obere','alle','Kontrakturprophylaxe und Erhalt des individuell möglichen Bewegungsumfangs','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-08','23','rumpf','alle','Stützung und Stabilisierung des Rumpfes beziehungsweise der Wirbelsäule','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-09','23','rumpf','alle','Haltungsführung und Unterstützung einer funktionellen Rumpfausrichtung','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-10','23','rumpf','alle','Schutz und Entlastung der betroffenen Wirbelsäulenabschnitte bei Alltagsaktivitäten','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-11','23','alle','alle','Erhalt oder Verbesserung der selbstständigen Durchführung individuell wichtiger Alltagsaktivitäten','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-12','23','alle','Folge','Anpassung der Orthesenfunktion an veränderten Befund und aktuelle Alltagsanforderungen','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('23-13','23','alle','Reparatur','Wiederherstellung der sicheren Funktion und Gebrauchsfähigkeit der vorhandenen Orthese','GKV-HMV PG23; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-01','24','alle','alle','Herstellung oder Verbesserung eines sicheren Standes mit der Prothese','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-02','24','alle','alle','Verbesserung eines sicheren und möglichst physiologischen Gangbildes entsprechend dem individuellen Mobilitätsziel','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-03','24','alle','alle','Erhöhung der selbstständigen Mobilität im häuslichen Umfeld und in relevanten Außenbereichen','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-04','24','alle','alle','Sicheres Bewältigen individuell relevanter Wege, Hindernisse und Untergründe','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-05','24','alle','alle','Verbesserung der Schaftpassform, des Tragekomforts und der Belastungsverteilung','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-06','24','alle','alle','Unterstützung der Teilhabe an persönlich wichtigen Aktivitäten in Alltag, Beruf und Freizeit','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-07','24','alle','Post-OP','Schrittweiser Aufbau der Prothesentoleranz und der sicheren Grundmobilität','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-08','24','alle','Interim','Begleitung der Stumpfveränderungen während der Interimsphase bei Erhalt sicherer Prothesennutzung','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-09','24','alle','Definitiv','Dauerhaft alltagsgerechte prothetische Mobilität entsprechend dem individuellen Funktionsniveau','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-10','24','alle','Folge','Anpassung der Prothesenversorgung an veränderte Mobilitätsanforderungen und körperliche Voraussetzungen','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT'),
  ('24-11','24','alle','Reparatur','Wiederherstellung der funktionellen Sicherheit und Zuverlässigkeit der vorhandenen Prothese','GKV-HMV PG24; redaktionell abgeleitet','REDAKTIONELL_GEPRUEFT')
on conflict (id) do update set pg=excluded.pg,region=excluded.region,versorgungsart=excluded.versorgungsart,zieltext=excluded.zieltext,quellenhinweis=excluded.quellenhinweis,updated_at=now();
-- Deliberately no public view or direct frontend table access; use reviewed static suggestions only until RLS-backed API release.
