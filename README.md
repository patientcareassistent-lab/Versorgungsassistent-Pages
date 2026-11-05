# Versorgungsassistent – Beratungsfokus

Statische Weboberfläche über GitHub Pages. Personen- und Gesundheitsdaten werden **nicht** im öffentlichen Repository gespeichert, sondern über den bestehenden authentifizierten Supabase-Zugriff bearbeitet.

## Kernfunktion

Papiergestützte Beratungsdokumentation ersetzen:
1. Patient und Vorgang zuordnen.
2. Verordnung erfassen (falls vorhanden).
3. Beratung und Befund erfassen; bei Reparatur wird stattdessen das Reparaturprotokoll genutzt.
4. Bei Bedarf Maße erfassen und für PG24-UKB die Prothesenkonfiguration abschließen.
5. Versorgungsziel und geplante Maßnahme festhalten.
6. Beratung speichern und bei Bedarf über den Browser als PDF ausgeben.

Die ursprüngliche Vertrags-/Formularlogik, Pflichtfeldprüfung, Reparatur-V13 und Prothesenkonfiguration bleiben bestehen. Spätere Produktions-, Kalkulations- und Genehmigungsstufen werden im Beratungsfokus nicht angezeigt. Die vorherigen Funktionen sind im Backup-Branch vollständig wiederherstellbar.

**Sicherung:** `backup/vollumfang-2026-11-05` (Commit `f36a1bdde3232a310225d9b21d1090d80c26afee`). Vorgehen: [Wiederherstellung](docs/beratung-fokus-wiederherstellung.md).

**Grenze:** Die bestehende Serverarchivierung erfordert weiterhin den alten Abgabeworkflow. Sie bleibt für den Altbestand erhalten, kann aber neue reine Beratungsfälle ohne gesonderte Backend-Anpassung nicht archivieren. Diese Änderung führt keine Datenbankmigrationen durch.

Deployment über GitHub Pages (`main`, GitHub Actions); Freigabe und Livegang separat.
