# PG24 – Reparaturtool V13: Integrations-Branch (unvollständig)

**Status: Nicht mergen, nicht veröffentlichen.** Die HTML-Datei des vollständigen sechsphasigen Reparaturtools V13 muss noch nach `tools/reparatur-uex/index.html` kopiert werden.

## Bisher vorbereitet

- Nur bei **Vorgangsart Reparatur und PG24** wird nach der Rezepterfassung das V13-Modul geladen.
- Die vorhandene Profilerhebung für Neuversorgungen und Reparaturen anderer PG bleibt unangetastet.
- Das eingebettete iframe erhält eine Sandbox ohne `allow-same-origin` und verwendet eine Tokenprüfung für den Datenaustausch.
- Auftragspatient, Kostenträger und technische Versorgungshöhe werden aus dem aktiven Vorgang übernommen, nicht erneut erhoben.
- Die strukturierten Reparaturdaten werden über das vorhandene Vorgangs-Autosave gesichert.
- Private Reparatur- und Bauteiletikett-Fotos bleiben im vorhandenen Storage; an das Modul gehen nur temporär signierte Ansichtslinks.
- Falls das Modul nicht geladen wird, bleibt aus Gründen der Ausfallsicherheit das bisherige Reparaturformular nutzbar.

## Fehlende Datei – Upload-Limitierung

Die verbundene GitHub-API erlaubt UTF-8-Dateiänderungen, aber keine direkte Übernahme von Dateien aus der lokalen ChatGPT-Sandbox. Das lokal getestete Originalmodul ist im Integrationspaket `VA_Reparatur_Integration_V13.zip` enthalten unter `VA_Reparatur_Integration_V13/tools/reparatur-uex/index.html`. Dieser Quelltext gehört **unverändert** an `tools/reparatur-uex/index.html`.

**Nicht** das unmodifizierte Offline-HTML hochladen: Im Integrationspaket ist die sandbox-isolierte Variante mit State-Bridge enthalten.

## Prüfpflicht vor Merge

1. Child-HTML hochladen; Browser-E2E mit synthetischen Daten auf dem Branch ausführen.
2. Klären, wo die Hilfsmittel-ID aus SIC in der Auftragserfassung liegt; fehlende IDs nicht erfinden.
3. Prüfen, ob das Rezept-Folgt-Kästchen unabhängig aus der Rezepterfassung bereitgestellt wird.
4. Vorgang speichern, schließen, wieder öffnen, überprüfen; unvollständige Artikelnummer muss Abschluss blockieren.
5. Private Fotos, PDF mit Bauteilklebern, Rechteprüfung, Wechsel zwischen zwei Versorgungen testen.
6. Vor Merge den aktuellen Hauptbranch erneut abgleichen; keine parallel entwickelten Dateien überschreiben.

Die bisher gespeicherten Reparaturfelder werden nicht gelöscht.
