# Archiv-Backend: staged rollout, no production cutover

Status: **ENTWURF – nicht live deployen**, bis der untenstehende Integrationsnachweis vorliegt. Aktive Patientenversorgungen dürfen nicht als Testdatensätze verwendet werden.

## DB: vorbereitete Service-RPCs
- `archive_context_for_service` (bereits live, read-only): nur `service_role`; aktive Teammitgliedschaft, optional Admin.
- `archive_mutation_for_service` (nur GitHub): `reserve`, `complete`, `cleanup`, `verify`, `delete_begin`, `delete_finalize`, `delete_fail`.
- `archive_restore_for_service` (nur GitHub): transaktionale Wiederherstellung von Stammdaten, Revisionen und Audit, Ersteller bleibt erhalten. Für die ursprünglichen Retention-Metadaten verwendet die Funktion einen eng begrenzten Restore-Trigger, der nur bei JWT-Rolle `service_role` greift.
- `app_private.care_case_archive_delete_attempts` (nur GitHub): Audit von Löschauslösung/Fehlschlägen; `care_case_archive_delete_log` wird nur bei tatsächlich abgeschlossener Löschung geschrieben.

## Dienste (noch nicht deployed)
- `archive-care-case` nutzt `archive_context_for_service` und `archive_mutation_for_service`, persistiert `archive_id` vor Upload, verwendet `care-cases/{case_id}/{archive_id}` und verifiziert jedes R2-Objekt, **bevor** ein transaktionaler SQL-Commit die aktive Versorgung und deren Historie entfernt.
- `verify-care-case-archive` nutzt denselben Manifestvalidator und prüft SHA-256 der ZIP/GZip-Hauptdatei und aller Fotodateien.
- `restore-care-case` akzeptiert nur verifizierte Archive, führt Foto- und Eigentümerprüfungen durch und stellt Stammdaten und Historie transaktional wieder her.
- `delete-care-case-archive` prüft die Datenschutz- und Aufbewahrungsvorgaben aus dem Archivindex (der aktive Vorgang existiert nach Archivierung nicht mehr), legt VOR jeder R2-Löschung einen Audit-Eintrag an, verifiziert Datei-Hashes und schließt die Löschung in einem SQL-Commit ab.
- `app.js` entfernt die ursprüngliche Eigentümerbeschränkung beim Archivieren; diese Datei **erst zusammen mit dem gesamten freigegebenen Backend** veröffentlichen.

## Sicherheitsbedingungen
MFA AAL2, gültiger Benutzer, aktive Freigabeliste, nur Service-Role für DB-RPCs, keine REST-Freigabe von `app_private`. Originaleigentümer bleibt unverändert, tatsächlicher Bearbeiter wird protokolliert.

Endgültige Löschung bleibt ausschließlich Admins vorbehalten: verifizierter Archivstatus, abgelaufene Aufbewahrung, kein Legal Hold, dokumentierte Begründung. Aktuell sind nur drei Nutzer mit Rolle `tester` vorhanden; **niemand ist als Admin für endgültiges Löschen freigeschaltet**.

## Freigabe-Gates (offen)
1. Deno-Compile der vier vollständigen Edge Functions einschließlich Shared Import.
2. Eigene isolierte R2-Testobjekte, **keine** produktiven Patientenfotos.
3. Zwei Benutzer mit MFA: Mitarbeiter A erstellt synthetischen PG23-Vorgang, Mitarbeiter B archiviert und verifiziert ihn, Mitarbeiter A oder B stellt ihn wieder her. Ersteller, Behandler, Fotos, Revisionshistorie und gesetzliche Aufbewahrungsfelder vergleichen.
4. Negative Tests: ungültiger Token, AAL1, nicht freigegebener Benutzer, Manipulation des Manifestes, falscher Objektpfad, falsche SHA256, veraltete Version der Versorgung während Archivupload.
5. Löschtest ausschließlich mit synthetischem Archiv nach kontrollierter Fälligkeits-Simulation: Nicht-Admin verweigert, Legal Hold verweigert, Frist nicht fällig verweigert, Dokumentationspflicht geprüft, fehlerhafter R2-Delete protokolliert.
6. Wiederanlauf nach Teilfehlern (PENDING, Foto-Restmengen, R2-Objekt vorhanden aber SQL-Abschluss fehlgeschlagen) mit sauberem Reconciliation-Pfad; insbesondere dürfen alte aktive Vorgänge niemals still verloren gehen.
7. Erst danach neue Migrationsdateien auf Supabase anwenden, die vier Edge Functions versioniert veröffentlichen, gezieltes Pages-Deployment auslösen und produktive Smoke-Abnahme durchführen.

## Synthetische Datenbank-Vorabtests
Am 08.10.2026 wurden `archive_mutation_for_service` und `archive_restore_for_service` jeweils innerhalb einer expliziten `BEGIN … ROLLBACK`-Transaktion mit synthetischen UUIDs geprüft:
- Reservieren und Abschluss; falscher Objektpfad führt zu Abbruch ohne Löschung des aktiven Vorgangs.
- Wiederherstellung durch anderes Teammitglied, Ersteller unverändert, `last_modified_by` korrekt, Audit-Eintrag angelegt.
- Löschbeginn durch Nicht-Admin wird verweigert; administrativer Begin-/Finalize-Ablauf protokolliert.
- Nach Rücknahme: 32 aktive Versorgungen und 0 Archive; schreibende RPCs nicht produktiv vorhanden.

**Diese Vorabtests ersetzen ausdrücklich keinen tatsächlichen isolierten R2-End-to-End-Test.**
