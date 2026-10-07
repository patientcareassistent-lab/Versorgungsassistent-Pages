# Production Readiness – Web / Free Plan

Stand: 07.10.2026

## Ergebnis

Der Versorgungsassistent ist als statische GitHub-Pages-Anwendung mit Supabase-Backend vollständig webbasiert. Für den laufenden technischen Umfang ist die Architektur mit GitHub Pages und Supabase Free kompatibel.

## Verifizierter Betriebsstand

- GitHub Pages wird aus dem Branch `main` per GitHub Actions veröffentlicht.
- Das Supabase-Projekt `Versorgungsassistent` ist aktiv, Region `eu-central-1`.
- Die Supabase-Organisation läuft im Tarif `free / tier_free`.
- Aktuelle PostgreSQL-Datenbankgröße bei der Prüfung: ca. 41 MB. Die dokumentierte Free-Plan-Grenze für den Übergang in Read-only liegt bei 500 MB.
- Das Frontend besitzt keine Laufzeitabhängigkeit auf `localhost`, `file://`, `/mnt/data` oder eine lokale SQLite-Datei.
- Im Frontend wird ausschließlich ein Supabase Publishable Key verwendet; kein `service_role`-/Secret-Key liegt im Browsercode.
- Der GitHub-Pages-Workflow enthält seit 07.10.2026 ein Production Safety Gate. Es blockiert Deployments bei Secret-Key-Markern oder lokalen Laufzeitpfaden.

## Patientenvorgänge / Zugriffsschutz

- Patientenvorgänge liegen in `public.care_cases`.
- RLS ist aktiviert.
- Zugriff erfordert authentifizierten Benutzer, aktive Freigabe in `app_private.app_members`, kein anonymes Konto und MFA/AAL2.
- AAL1 wurde geprüft: `current_access()` verweigert Zugriff und Patientenvorgänge sind nicht sichtbar.
- AAL2 wurde geprüft: `current_access()` erlaubt einem aktiv freigegebenen Benutzer den Zugriff.
- Ein transaktionaler Insert-/Update-Test für `care_cases` erzeugte erwartungsgemäß zwei Audit-Ereignisse und zwei Revisionen. Der Test wurde vollständig zurückgerollt; es blieben keine Testdaten zurück.
- `anon` besitzt keine Tabellenrechte auf Patientenvorgänge.
- Audit- und Revisionsdaten sind für Frontend-Rollen nicht direkt lesbar.

## Security Advisor

Am 07.10.2026 wurden `pg_trgm` und `unaccent` aus dem Schema `public` in `extensions` verschoben. Die abhängige Funktion `public.rb_search_supply` wurde auf `extensions.unaccent` angepasst. Der frühere Security-Advisor-Hinweis „Extension in Public“ ist damit beseitigt.

Als verbleibender Security-Advisor-Hinweis wird „Leaked Password Protection Disabled“ gemeldet. Laut aktueller Supabase-Dokumentation ist diese Funktion erst ab Pro verfügbar. Im Free-Plan wird dieses Restrisiko durch verpflichtendes MFA/AAL2 und die zusätzliche Freigabeliste kompensiert. Das ist eine dokumentierte Tarifgrenze, kein Konfigurationsfehler des Projekts.

## Performance Advisor

Die verbleibenden Hinweise sind INFO-Meldungen:

- Tabellen ohne Primary Key befinden sich in `reference_stage` und `reference_backup_20261006`.
- Mehrere Indizes werden aktuell als ungenutzt gemeldet.

Diese Objekte sind nicht die produktive Patientendatenschnittstelle. Stage-/Backup-Schemata haben keine Rechte für `anon` oder `authenticated`. Ungenutzte Indizes werden bei der aktuell jungen Datenbank nicht allein aufgrund kurzfristiger Statistik entfernt.

## Noch offene Freigabepunkte außerhalb der Free-Plan-Technik

Die technische Web-/Free-Plan-Kompatibilität ersetzt keine datenschutzrechtliche Produktivfreigabe. Vor echtem Regelbetrieb mit Gesundheitsdaten bleiben insbesondere DPA/AVV, DSFA/TOM-Freigaben, Aufbewahrungsfristen, Wiederherstellungstest sowie die Bewertung der extern geladenen JavaScript-/OCR-Abhängigkeiten zu entscheiden.

