# Qualitäts- und Release-Gate – Versorgungsassistent v0.9

## Herkunft und Geltungsbereich
Abgleich mit den vorhandenen GitHub-Workflows aus den Projekten `Versorgungsassistent`, `Vertragsnavigator` und `Rezeptbr-cke` am 08.10.2026. Die Regeln gelten für das GitHub-Pages-Repository. Sie ersetzen keine rechtliche oder medizinische Freigabe.

## Freigabekriterien (P0)
1. Änderungen zuerst auf Feature-Branches, anschließend Review/PR nach `main`. Parallele Chats dürfen nicht unkoordiniert dasselbe zentrale `app.js` überschreiben.
2. Statische Sicherheitsprüfung: Keine privilegierten Supabase-Schlüssel im Browser; kein direkter Zugriff auf `app_private`; Datenbankmigrationen mit aktivierter RLS und geprüften Policies.
3. Bestehende Security-Tests, PR-Validierung, Browser-Regression, Quell- und Laufzeitprüfungen müssen erfolgreich sein.
4. End-to-End testen: Neuaufnahme, Rezept ja/nein, OCR korrigierbar, PG-/Kassenbogen, Speichern, Wiederaufnahme, gemeinsame Sichtbarkeit Mitarbeiter1–3 und Archiv.
5. Neues Deployment nur als erfolgreich ansehen, wenn der aktuelle Pages-Lauf `success` meldet. `cancelled` wegen neuerem Commit ist kein Buildfehler; wiederholte Abbrüche blockieren aber die Freigabe.
6. Verarbeitung echter Patientendaten erst nach separater Datenschutz- und Berechtigungsprüfung. Testläufe vorzugsweise mit synthetischen Daten.

## Wiederverwendung und Abgrenzung
- Übernommen: wöchentliches Security-Gate, Secret-Checks, private Schema-Grenzen, statischer RLS-Check und PR-Checkliste aus `Versorgungsassistent`; Migrationsvalidierungsidee aus `Rezeptbr-cke`.
- Bereits vorhanden und beizubehalten: `pr-validate.yml`, `supabase-security.yml` und Pages-Browsertests.
- Nicht übernommen: pauschales Verbot von PDF/XLSX im Repository, da Formular- und Quellenartefakte hier benötigt werden können.
- Nicht automatisch übernommen: entfernte Supabase-Migrations-Dry-Runs. Sie benötigen eigens freigegebene Secrets, sind von der statischen Prüfung zu unterscheiden und dürfen keine Produktivdaten ändern.
- Nicht für v0.9: Kalkulation und Abrechnung im sichtbaren Frontend.

## Merge-Bedingung
Quality-Gate und bestehende PR-Checks überprüfen. Das Ruleset `Versorgungsassistent v0.9 Release` ist auf `main` aktiv: Pull-Request-Pflicht, `validate` erforderlich, null menschliche Freigaben und Schutz vor Force-Push/Löschung. Qualitätsprüfungen laufen zusätzlich; das Quality-Gate ist nicht als zweiter erforderlicher GitHub-Statuscheck konfiguriert.

## Technische Grenzen
Ein erfolgreicher CI-Check allein bestätigt keine Datenschutzkonformität oder vollständige Funktion. Statische Regex-Prüfungen sind nur zusätzliche Frühwarnungen; RLS und Berechtigungen müssen zusätzlich in Supabase und browserseitig getestet werden.
