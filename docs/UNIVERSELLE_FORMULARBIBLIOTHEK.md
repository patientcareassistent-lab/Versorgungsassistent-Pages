# Zentrale Formularbibliothek – alle Kostenträger und Produktgruppen

## Stand
Stufe 1: bibliotheksfähiger Resolver und versionsgebundener Katalog. Bestehende Masken bleiben unangetastet, bis alle Vorlagen und Feldmatrizen geprüft sind. Dies ist ausdrücklich noch **keine** vollständige Aktivierung des R2-Formularbetriebs.

## Architektur
- GitHub Pages: UI, PDF.js, dynamische Eingabeoberfläche.
- Cloudflare R2 (privater Bucket): ausschließlich unveränderte Formularvorlagen; jede Version hat einen unveränderlichen Objektschlüssel und SHA-256.
- Cloudflare Worker: authentifiziertes Ausliefern des Formulars per Dokument-ID und Version; keine patientenbezogenen URL-Parameter, keine ungeschützten R2-Links.
- Supabase: bisherige Fall-/Versorgungsdaten sowie künftig geprüfte Feldzuordnungen und Formularversionen, RLS und Mandantenrechte beibehalten.
- Ausgabe im Browser: ausgefüllte PDF erst bei Bedarf clientseitig erzeugen; keine automatische Ablage ausgefüllter PDFs in R2.

## Allgemeingültige Auflösung
Kostenträger + PG + Vertragsfassung + Versorgungsart + Dokumenttyp + Stichtag bestimmen die Vorlage. Ein Freigabestatus 'verified' setzt eine geprüfte SHA-256 und eine geprüfte semantische Feldmatrix voraus. Bei unbekannter Vertragsfassung **keine automatische Auswahl**. Ohne zugeordnete Vertrags-PDF bleibt die bisherige dynamische Erhebung funktionsfähig.

## AOK Baden-Württemberg
PG24 Anlage 4 ist das maßgebliche Original. Separat dargestellte Erhebungsfelder werden bei AOK BW nicht zusätzlich eingeblendet. Formularinhalt darf gegenüber dem Vertrag nicht ergänzt werden. Bei PG23 ist die Vertragsfassung (2023 / 2026) ausdrücklich zu unterscheiden.

## Abnahmekriterien der nächsten Stufe
1. R2-Konto/Free-Plan überprüft, Bucket privat eingerichtet, Zugriff nur via authentifiziertem Worker.
2. Original-PDFs quellgetreu und versioniert hochgeladen; Prüfsummen und Dateimetadaten erfasst.
3. Alle PDF-Felder und Freitext-/Signatur-Overlays seitenweise gegen das Original verifiziert; Schreibbarkeit jeder Pflichtangabe getestet.
4. Eindeutige Feld-IDs einschließlich Kontext (Kasse, PG, Vertrag, Seite, Versorgungsart); Transkript nur für verifizierte Zuordnungen.
5. Autovervollständigung und PDF-Export mit synthetischen Daten getestet, einschließlich beidseitiger Versorgungen.
6. Keine Patientendaten in GitHub, öffentlichem R2 oder Logs. DSGVO/AVV/R2-Datenlokation separat prüfen.
7. Änderungen erst nach bestandenen Tests und Prüfung paralleler PRs in main übernehmen.
