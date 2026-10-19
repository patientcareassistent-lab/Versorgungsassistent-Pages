# PG24 Prothetik uEx – Reparaturtool V13: Integrationsstand (19.10.2026)

**Status: Feature-Branch / Draft PR #53; noch nicht produktiv.**

## Umsetzung

- V13-Modul vorhanden unter `tools/reparatur-uex/index.html` (originaler zweiseitiger Reparaturbogen inklusive).
- Bei **Vorgangsart Reparatur + PG24** wird das neue Tool in Schritt 3 direkt nach der Rezepterfassung geladen. Keine Änderungen der Profilerhebung für Neuversorgungen oder andere PG.
- Die bisherige Reparaturdokumentation bleibt im Datensatz erhalten und wird bei Bestandsfällen schreibgeschützt als aufklappbare Alt-Dokumentation gezeigt.
- Die **Hilfsmittel-ID aus SIC** wird künftig nur in der Auftragserfassung bei Reparatur + PG24 erfasst. Sie unterscheidet sich von SIC-Vorgangsnummer und SIC-Kalkulationsmuster. Im Tool keine Zweiteingabe.
- **Rezept folgt** und optionaler Verordner werden bei PG24-Reparaturen ausschließlich in der Rezepterfassung (ohne Verordnung) erhoben; keine Ableitung allein aus "Verordnung vorhanden: Nein".
- Reparaturdatum wird aus dem Versorgungsvorgang an V13 übergeben; die Reparatur kann es für die Dokumentation ändern.
- Erfassung von Reparaturpositionen, Passteilen (Hersteller-Artikelnummer verpflichtend), optionalen anklickbaren HMV-/GPOS-Hinweisen, Arbeitsschritten, SIC-Musternummer, A4-Originalbogen.
- Reparaturdaten werden über die vorhandene Vorgangsspeicherung persistiert. Beim Wechsel zwischen zwei Fällen wird der V13-Kontext neu initialisiert.
- Prothesenfotos und Bauteiletiketten bleiben im geschützten Storage des Assistenten und werden nur mit zeitlich begrenzten Ansichtslinks an die isolierte, sandboxed Druckansicht übergeben.
- Bisheriges Reparaturprotokoll bleibt bei Ladefehlern als Fallback verfügbar; keine Datenlöschung.

## Tests

- Statische Sicherheits- und Syntaxprüfungen in GitHub Actions.
- Browsertest `repair-v13.spec.cjs` für Sandbox, Positionshilfe, Pflichtfelder und Abschluss.
- Integrierter Browsertest `repair-v13-wizard.spec.cjs` mit ausschließlich synthetischen Daten für Speichern, Wiederöffnen, PDF-Originalseiten, Fotoübernahme und Vorgangstrennung.
- Der vollständige Browser-Regressionstest muss am endgültigen PR-Commit erfolgreich sein. Bei Scheitern **nicht mergen**.

## Vor Freigabe

1. Alle drei GitHub-Workflows des endgültigen PR-Commits müssen erfolgreich sein.
2. Aktuellen `main` erneut auf fremde Änderungen prüfen.
3. Produktiv-CSP, private Storage-Richtlinien und die Anzeige von Altbeständen im Browser kontrollieren.
4. Nach Merge GitHub-Pages-Deployment kontrollieren. Mit Testdaten prüfen, niemals Produktivpatientendaten für E2E verwenden.
5. `Rezept folgt` darf nie aus `rxPresent=Nein` abgeleitet werden; Vertragssonderregeln bleiben fachlich zu prüfen.
