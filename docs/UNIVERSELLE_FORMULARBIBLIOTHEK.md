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


## Technischer Ist-Stand 13.10.2026
- Cloudflare-Bucket **versorgungsassistent-formulare** angelegt: privat, keine r2.dev-Freigabe, keine Custom Domain. Speicherplatzierung WEUR ist ein Location-Hint, **keine zugesicherte EU-Jurisdiktion**.
- R2-Katalog **catalog/massblaetter-2026-10-13.json** mit neun Einträgen unter Status **staged** tatsächlich hochgeladen. Stand heute enthält der Bucket **noch keine Originaldateien**.
- Cloudflare Worker **versorgungsassistent-formular-gateway** angelegt und workers.dev aktiviert. Der Worker verlangt Bearer-Token und verifiziert Mitgliederrechte via `public.current_access()` in Supabase. Dokumente und Katalogauskunft sind für anonyme Nutzer gesperrt; nur die unsensitive Health-Route ist öffentlich.
- Supabase-Tabelle `app_private.formular_vorlagen_r2` per Migration angelegt: 9 Quellen registriert, alle im Status `staged`; RLS aktiviert, keine SELECT-/Schreibrechte für `anon` und `authenticated`.
- Im Feature-Branch lädt die AOK-PG24-Oberfläche originale Maßblätter und den Profilerhebungsbogen nach erfolgreichem Import bevorzugt über den Worker als Browser-Blob. Bei fehlenden R2-Dateien bleibt der bisherige Ladepfad unverändert.
- Die Quell-PDFs enthalten keine ausgefüllten PDF-Widgetwerte; Patienten-/Versorgungsdaten werden nicht in den R2-Bucket hochgeladen.

### Inventar für den Einmalimport (7 Maßblätter plus 2 Profile)
- AOK BW PG24: Maßblätter Anlagen 5a/5b/5c/5d/5e, Vertrag ab 01.09.2026.
- PG23 allgemeine Orthetik: Erhebungsbogen/Maßblatt untere Extremität als PDF und Pohlig-Maßblatt als DOCX.
- Ergänzend AOK BW PG24: Anlage 4 Profilerhebungsbogen (Original-PDF).
- Ergänzend AOK BW PG23: vorhandener AOK-Bogen untere Extremität; Vertragszuordnung 2023/2026 vor Aktivierung prüfen.

Alle Vorlagen sind bitidentisch aus den Projektarchiven entnommen und mit SHA-256 und Prüfprotokoll im lokal erzeugten Import-ZIP **Versorgungsassistent_Massblaetter_R2_Import_2026-10-13.zip** vorbereitet.
Das mitgelieferte PowerShell-Skript überträgt neun Quellvorlagen über `npx wrangler r2 object put --remote`, liest jede zurück und prüft erneut SHA-256. **Nur bei vollständigem Erfolg** schaltet es den R2-Katalogstatus auf `uploaded`.
Kein API-Token und keine Patientendaten sind im Import-ZIP enthalten. Wegen fehlendem Binär-Uploadkanal der verbundenen Cloudflare-Schnittstelle kann der Chat diese Quelldateien nicht direkt in R2 einspielen.

### Noch ausstehende technische Abnahme
1. Einmaligen verifizierten Dateiimport ausführen und anschließend die neun R2-Objekte gegen das lokale Manifest prüfen.
2. Supabase-Vorlagenregister synchron von `staged` auf `uploaded` setzen, aber `active` erst nach geprüfter PDF-Feldmatrix.
3. Die 509 Widget-Felder der sechs Maßblatt-PDFs und zusätzlich die Profile quellengebunden semantisch zuordnen; DOCX als Original beibehalten und eine eigene geprüfte PDF-Anzeige vorbereiten.
4. Browserprüfung mit Testdaten (nicht Patientendaten) für alle Maßblätter; Vertrag, Unterschrift, Maße, bilateral und Transkriptionsmapping.
5. GitHub-PR erst nach erfolgreichem CI, DSGVO-Review, Vertragsversionsprüfung und Abstimmung mit parallelen PRs zusammenführen. Kein vorzeitiger Produktivwechsel.

Kostenhinweis: Die vorgesehenen Mengen liegen deutlich unter dem Cloudflare-R2-Free-Tier-Speicherkontingent; zusätzliche Lese-/Schreibaufrufe können bei Überschreitung dennoch Kosten verursachen.
