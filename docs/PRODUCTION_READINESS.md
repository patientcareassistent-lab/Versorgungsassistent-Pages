# Production Readiness – Web / Free Plan

Stand: 07.10.2026

## Ergebnis

Der Versorgungsassistent ist als statische GitHub-Pages-Anwendung mit Supabase-Backend vollständig webbasiert. Für den laufenden technischen Umfang ist die Architektur mit GitHub Pages und Supabase Free kompatibel. Der aktuelle Stand wurde nach der Team-Sichtbarkeitsänderung erneut technisch tief geprüft und gehärtet.

## Verifizierter Betriebsstand

- GitHub Pages wird aus dem Branch `main` per GitHub Actions veröffentlicht.
- Das Supabase-Projekt `Versorgungsassistent` ist aktiv, Region `eu-central-1`.
- Die Supabase-Organisation läuft im Tarif `free / tier_free`.
- Aktuelle PostgreSQL-Datenbankgröße bei der Prüfung: ca. 41 MB.
- Das Frontend besitzt keine Laufzeitabhängigkeit auf `localhost`, `file://`, `/mnt/data` oder eine lokale SQLite-Datei.
- Im Frontend wird ausschließlich ein Supabase Publishable Key verwendet; kein `service_role`-/Secret-Key liegt im Browsercode.
- Der GitHub-Pages-Workflow enthält Production-, Runtime- und Browser-Regression-Gates.
- Das veröffentlichte Pages-Artefakt wird inzwischen explizit in `dist/` aufgebaut. Entwicklungsdateien, Tests, Projektdokumentation und das alte `projektportal/` werden nicht mehr als Website ausgeliefert.
- Verwendete GitHub Actions sind auf konkrete Commit-SHAs gepinnt.
- AOK-PG24-Quelldokumente werden beim Build fail-closed geprüft: fehlender Abruf, fehlende Anlage oder ungültiger PDF-Download verhindert das Deployment.

## Patientenvorgänge / Zugriffsschutz

- Patientenvorgänge liegen in `public.care_cases`; RLS ist aktiviert.
- Zugriff erfordert authentifizierten Benutzer, aktive Freigabe in `app_private.app_members`, kein anonymes Konto und MFA/AAL2.
- Es existieren aktuell 3 Auth-Benutzer, 3 aktive App-Mitglieder, keine verwaisten Mitgliedschaften und 3 Benutzer mit verifiziertem TOTP.
- Team-Sichtbarkeit ist umgesetzt: jeder freigegebene Mitarbeiter kann alle offenen Versorgungen lesen.
- Änderungen an einer Versorgung bleiben dem jeweiligen Ersteller vorbehalten.
- Fremde Versorgungen werden im Frontend ausdrücklich im Nur-Lesen-Modus geöffnet; Drucken bleibt möglich.
- Reparatur- und Etikettfotos sind ebenfalls teamweit lesbar, Upload und Löschen bleiben owner-only.
- Live-RLS-Test mit AAL2: ein geprüfter Mitarbeiter sah 30 Vorgänge, davon 4 eigene und 26 fremde, sowie alle 4 vorhandenen Reparaturbildobjekte.
- Gegenprobe mit AAL1: 0 sichtbare Vorgänge und 0 sichtbare Reparaturbildobjekte.
- Ein fremder UPDATE-Versuch ergab 0 geänderte Datensätze.
- `care_case_overview` ist `security_invoker` und besitzt für `authenticated` nur noch `SELECT`.
- `anon` besitzt keine Tabellenrechte auf Patientenvorgänge.
- Audit- und Revisionsdaten sind für Frontend-Rollen nicht direkt lesbar.
- `last_modified_by` ist nach Bereinigung eines Alt-Datensatzes `NOT NULL`; serverseitige/systemische Updates können den letzten Bearbeiter nicht mehr versehentlich auf `NULL` setzen.
- Das Löschen eines Supabase-Auth-Benutzers kann dessen Versorgungsfälle nicht mehr per FK-Kaskade löschen (`owner_user_id` verwendet `ON DELETE RESTRICT`).
- `payload` muss serverseitig ein JSON-Objekt bleiben und ist pro Vorgang auf 512 KiB begrenzt; `schema_version` ist auf 1–100 begrenzt.
- Vollständige Payload-Revisionen werden innerhalb derselben Bearbeitungssitzung (gleicher Benutzer, Status und Wizard-Schritt, maximal 5 Minuten Abstand) zusammengefasst. Audit-Ereignisse bleiben separat erhalten. Das reduziert Datenbankwachstum im Free-Plan deutlich, ohne die fachlichen Zustandswechsel zu verlieren.

## Browser- und Sitzungsdaten

- Supabase-Auth wird nur noch in `sessionStorage` gehalten; das Schließen der Browsersitzung beendet die lokale Persistenz.
- `detectSessionInUrl` ist deaktiviert.
- Legacy-Auth-Tokens aus der früheren LocalStorage-Konfiguration werden beim Start entfernt.
- Passwort, OTP und ein gegebenenfalls angezeigtes TOTP-Enrolment-Secret werden nach erfolgreicher Authentisierung aus dem DOM geleert.
- Patientenname und Versichertennummer verwenden kein Browser-Autocomplete.
- Reparaturbilder werden mit `cacheControl: 0` hochgeladen; signierte Anzeige-URLs sind auf 5 Minuten begrenzt und werden nur kurzzeitig im Arbeitsspeicher wiederverwendet.

## Teamübersicht / Skalierung

- Die offene Versorgungsliste wird paginiert aus Supabase geladen und ist nicht mehr auf die ersten 250 Vorgänge begrenzt.
- Ein Browser-Regressionstest deckt explizit mehr als 250 offene Team-Vorgänge ab.

## Stillgelegte Altpfade

Folgende Versorgungsassistent-Endpunkte liefern nur noch `410 Gone` und verlangen zusätzlich JWT:

- `reference-import-once`
- `versorgungsassistent`
- `versorgungsassistent-js`
- `versorgungsassistent-css`

`provision-test-users-once` und `reference-snapshot-maintenance` waren bereits auf `410 Gone` gestellt.

Die Rezeptbrücke ist fachlich nicht Bestandteil dieses Projekts und wurde bei dieser Härtungsrunde nicht verändert.

## Wiederherstellungsprüfung

Am 07.10.2026 wurde die Revisionsarchitektur erweitert: jede neue INSERT-/UPDATE-Revision enthält zusätzlich einen kompakten Metadaten-Snapshot (`row_snapshot`); der bereits vorhandene `payload` bleibt separat gespeichert. Zusammen bilden beide Bestandteile einen vollständig rekonstruierbaren fachlichen Versorgungsdatensatz. Für alle 30 bestehenden Versorgungen wurde die jeweils letzte Revision entsprechend nachgerüstet.

Ein transaktionaler Restore-Drill bestätigte 0 fehlende Snapshots und 0 Abweichungen im vollständigen fachlichen Datensatz. `updated_at` und `last_modified_by` werden bei einer tatsächlichen Wiederherstellung bewusst neu erzeugt und sind deshalb nicht Teil des fachlichen Vergleichs. Ein zusätzlicher Rollback-Test erzeugte bei einer temporären Änderung genau eine neue, vollständige Revision. Sämtliche Drill-Änderungen wurden zurückgerollt.

- Der vorbereitete Retention-Purge verlangt jetzt eine dokumentierte Begründung und bricht ab, solange zu fälligen Fällen noch Reparaturbilder im privaten Storage liegen. Ein Dry-Run am 07.10.2026 ergab 0 fällige Fälle.
- Die teamweite offene Versorgungsliste besitzt einen eigenen partiellen Index auf `updated_at DESC` für nicht abgeschlossene Fälle.

## Externe Archivierung

- Der Backend-Dienst `archive-care-case` ist JWT-geschützt und prüft zusätzlich gültige Benutzer-Sitzung, MFA/AAL2, aktive App-Mitgliedschaft und Eigentümerschaft am Vorgang.
- Eine Archivierung wird im Frontend erst freigegeben, wenn alle für den Versorgungspfad relevanten Arbeitsschritte vollständig sind. Der Backend-Dienst verlangt zusätzlich Abschlussstatus, Abgabe-Bestätigungen und Abrechnungsstatus.
- Bildreferenzen werden serverseitig gegen Eigentümer, Vorgangs-ID und erlaubte Unterordner validiert; maximal 4 Reparatur- und 10 Etikettbilder werden akzeptiert.
- Archivläufe werden in `app_private.care_case_archives` als PENDING/READY/FAILED geführt. Wiederholungen nutzen dieselbe Archiv-ID; ein bereits READY archivierter Vorgang wird idempotent behandelt.
- Der finale Statuswechsel auf `Abgeschlossen` erfolgt im Benutzerkontext statt über den Service-Role-Kontext, damit Audit-Akteur und letzter Bearbeiter nachvollziehbar bleiben.
- Archivindex und operative Aufbewahrungsmetadaten werden synchronisiert. Ein lokaler Purge wird blockiert, solange noch ein externer Archiveintrag oder private Reparaturbilder vorhanden sind.
- Der Funktionsquelltext ist unter `supabase/functions/archive-care-case/index.ts` im Repository versioniert, wird aber nicht in das öffentliche Pages-`dist` aufgenommen.
- Zum Prüfzeitpunkt existierten 0 erfolgreiche Archiveinträge. Die produktive Konfiguration des externen R2-Backends kann aus dem Frontend nicht verlässlich festgestellt werden und bleibt ein eigener Freigabepunkt.

## Security Advisor

Als verbleibender Security-Advisor-Hinweis wird `Leaked Password Protection Disabled` gemeldet. Im Free-Plan wird dieses Restrisiko derzeit durch verpflichtendes MFA/AAL2 und die zusätzliche Freigabeliste kompensiert.

## Performance Advisor

Die verbleibenden Hinweise sind INFO-Meldungen:

- Tabellen ohne Primary Key befinden sich überwiegend in `reference_stage` und `reference_backup_20261006`.
- Mehrere Indizes werden aktuell als ungenutzt gemeldet.

Diese Objekte sind nicht die produktive Patientendatenschnittstelle. Ungenutzte Indizes werden bei der aktuell jungen Datenbank nicht allein aufgrund kurzfristiger Statistik entfernt.

## Noch offene Freigabepunkte

Die technische Web-/Free-Plan-Kompatibilität ersetzt keine datenschutzrechtliche Produktivfreigabe. Vor echtem Regelbetrieb mit Gesundheitsdaten bleiben insbesondere:

- finale AVV/DPA-, DSFA-, TOM- und VVT-Freigaben,
- regelmäßige Wiederholungen des dokumentierten Restore-Drills,
- verbindliche Aufbewahrungs- und Löschregeln einschließlich externer Archivobjekte,
- formale Freigabe der Cloudflare-R2-Nutzung (DPA/AVV, Region/Transfers, private Bucket-Konfiguration, Lösch-/Restore-Prozess) oder Deaktivierung der Archivfunktion,
- Bestätigung der GitHub-Branch-Protection durch einen Repository-Admin; über die verfügbare GitHub-App war dieser Admin-Endpunkt nicht lesbar,
- regelmäßige kontrollierte Dependency- und Security-Advisor-Prüfung.

