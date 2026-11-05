# Sicherung und Wiederherstellung – Beratungsfokus (05.11.2026)

## Gesicherter Ausgangsstand
- Repository: `patientcareassistent-lab/Versorgungsassistent-Pages`
- Ausgangscommit: `f36a1bdde3232a310225d9b21d1090d80c26afee`
- Vollständiger Code-Sicherungsbranch: `backup/vollumfang-2026-11-05`
- Entwicklungsbranch: `feature/beratung-fokus-2026-11-05`
- Quelle des Backups: gesamte Git-Historie und alle von Git verwalteten Dateien zum genannten Commit (inkl. alter Workflows, Module, Tests, Migrationen).

## Was sich in der neuen Version ändert
- Beratungsfokus ist der Standard: Vorgang, Verordnung, Beratung/Profilerhebung bzw. Reparatur, Maße, erforderliche UKB-Konfiguration und Versorgungsziel.
- Nachgelagerte Produktions-, Kalkulations-, Genehmigungs-, Verlaufs- und Abgabeschritte werden nicht mehr als reguläre Schritte angezeigt.
- Das vorhandene Reparaturprotokoll, die Konfigurationsmodule und die dazugehörigen Sicherheitsregeln bleiben in den Quelldateien bestehen.
- Es werden keine Datenbankmigrationen ausgeführt, keine Patientendaten exportiert oder gelöscht und keine Zugangsdaten im Git-Backup abgelegt.
- Das bestehende externe Archiv bleibt les- und wiederherstellbar; die Archivierung neuer Beratungsfälle ist mit dem alten serverseitigen Archivierungs-Preflight **noch nicht möglich**. Für dessen Anpassung ist eine gesonderte, geprüfte Änderung nötig.

## Wiederherstellung des vorherigen Funktionsumfangs
1. Nicht direkt den Live-Branch zurücksetzen. Zunächst neuen Wiederherstellungsbranch aus dem aktuellen `main` erstellen.
2. Auf dem Wiederherstellungsbranch die Git-Dateien des gesicherten Ausgangscommits zurückholen:
   ```bash
   git switch main
   git pull --ff-only
   git switch -c restore/vollumfang
   git restore --source=f36a1bdde3232a310225d9b21d1090d80c26afee --staged --worktree .
   git commit -m "restore: vorherigen vollständigen Funktionsumfang"
   ```
3. Neue Dateien, die erst nach dem Sicherungscommit entstanden sind, getrennt prüfen und gegebenenfalls explizit entfernen. `git restore` entfernt solche unversionierten/neu hinzugefügten Dateien nicht automatisch.
4. Differenz gegen Sicherungscommit prüfen, automatisierte Tests und Sicherheitsregeln ausführen und erst danach PR in `main` freigeben.
5. Supabase-Daten und Cloudflare-R2-Archive **nicht** zurücksetzen. Diese Änderung betrifft ausschließlich die Weboberfläche; eine davon unabhängige, geprüfte Datenbanksicherung wäre für eine echte Datenwiederherstellung erforderlich.

## Veröffentlichung
Der Entwicklungsbranch wird als Draft-PR bereitgestellt. Merge und Live-Deployment erst nach ausdrücklicher Freigabe.
