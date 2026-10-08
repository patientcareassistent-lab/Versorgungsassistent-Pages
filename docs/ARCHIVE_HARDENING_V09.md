# Archiv-Härtung v0.9 – kontrollierte Umsetzung

Status: **P0 in Bearbeitung**, Datenbank-Read-Gateway live; Archivierung, Verifizierung, Wiederherstellung und endgültige Löschung **nicht freigegeben**.

## Verbindliches Vertragsformat für neue Archive
- Präfix: `care-cases/{care_case_id}/{archive_id}/` (nie Benutzer-ID oder Patientendaten im Objektschlüssel).
- Manifest: `versorgung.json.gz` unter diesem Präfix, mit `manifest_version: 1`, `archive_id`, `care_case.id` und unveränderlichem `care_case.owner_user_id`.
- Fotos: `files/repair/<filename>` oder `files/labels/<filename>`; pro Datei SHA-256, maximal 14, Größe maximal 3 MiB.
- **Der tatsächlich archivierende Mitarbeiter** ist `archived_by` und darf vom ursprünglichen `owner_user_id` abweichen.
- R2-Dateiinhalt und Metadaten müssen vor der Löschung der operativen Kopie vollständig gegen Hash und Größe verifiziert werden.
- `archive-layout.mjs` enthält den kanonischen Prüfer und ist durch `npm run test:security` abgesichert.

## Bereits behobener Zugriff
- `public.archive_context_for_service(actor_id,case_id,require_admin,include_history)` liest Daten aus `app_private` in einer `SECURITY DEFINER`-Funktion.
- EXECUTE ausschließlich `service_role`, nicht `anon` oder `authenticated`.
- Vor jedem Funktionsaufruf sind verifizierte JWT-Sitzung, AAL2, Nicht-Anonymität und Freischaltung des Mitarbeiters zu prüfen; die RPC prüft aktive Mitglieder und optional Admin-Rolle erneut.
- Das Gateway ist absichtlich **nur lesend**. Es verändert noch keine Patientenakten oder Archive.

## Offene Integrationsschritte – vor Freigabe
1. `archive-care-case`: alte `admin.schema("app_private")`-Aufrufe vollständig ersetzen; gemeinsame Bearbeitungsrechte; Originaleigentümer unverändert; neue Archivkennung vor Upload vergeben; einheitliche Pfade; **ein DB-transaktionaler Abschluss** erst nach R2-Hash- und Größenprüfung. Bei Teilerfolg ohne Quelllöschung ist der Vorgang ausdrücklich als unvollständig zu kennzeichnen.
2. `verify-care-case-archive`: gleicher Kontext und kanonische Manifestprüfung; SHA-256 aller Objekte; unveränderliche Prüf- und Auditmetadaten.
3. `restore-care-case`: Manifest-/Foto-Pfade, Prüfsummen und Owner-Wahrung; Änderung durch beliebiges aktives MFA-Teammitglied; revisionssichere Wiederherstellung.
4. `delete-care-case-archive`: **keine Abhängigkeit von aktivem `care_cases`-Datensatz** nach Archivierung. Fälligkeit und Legal Hold aus archiviertem Governance-Eintrag prüfen, Admin-Rolle und begründete Löschung voraussetzen; R2- und SQL-Löschung ausfallsicher protokollieren.
5. Frontend erst dann für Team-Archivierung/-Wiederherstellung freischalten, wenn Backend-Checks und synthetischer Ende-zu-Ende-Lauf erfolgreich sind.

## Abnahme (ohne Patientenakten)
- Zwei unterschiedlich freigegebene MFA-Benutzer, einer als Ersteller und einer als Bearbeiter.
- Synthetischer PG23/24-Vorgang mit Prüfsummen und Testfoto: Archivieren -> Index/Manifest/Fotos prüfen -> Wiederherstellen -> erneutes Öffnen.
- Negative Prüfungen: keine MFA, nicht freigegebener Nutzer, falsche Datei-Prüfsumme, manipulierte `archive_id`, Pfadabweichung, Retention nicht fällig, Legal Hold, Nicht-Admin beim endgültigen Löschen.
- Nur synthetische Daten; keine Probelöschung produktiver Versorgung oder Archivkopie.

Sonderbefund: Die derzeit deployte Archivierungs-Edge-Function verwendet noch das Format `care-cases/{archived_by}/{care_case_id}/{timestamp}`, während Verifizierung und Löschung `care-cases/{care_case_id}/{archive_id}` erwarten. Der Service-Context-PR **behebt diesen Formatbruch noch nicht produktiv**.
