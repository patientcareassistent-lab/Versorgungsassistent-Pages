# Anamnese 0.9 – risikobasierte Testmatrix (Stand 08.10.2026)

## Freigabegrenze

Die produktive Benutzeroberfläche stellt ausschließlich PG23 und PG24 zur Auswahl. PG04/05/08/10/11/15/17/18/20/22/26/28/31/32/33/38 und weitere vorhandene PG-Daten bleiben erhalten, sind aber **keine produktiv freigeschalteten Versorgungswege**. Funktionstests anderer PGs erfolgen nur mit synthetischen Daten in isolierten Testläufen. Keinen Testfall mit echten Patientendaten ausführen.

## Prüfverfahren

Für jeden nachstehenden Testfall: (1) neue Versorgung anlegen, (2) Stammdaten einmal erfassen, (3) Rezept ja/nein und gegebenenfalls lokale OCR + manuelle Korrektur, (4) Kasse, PG und Himi zuordnen, (5) Anamnesebogen auf Quelle, Pflichtstatus und Bedingungen prüfen, (6) erforderliches Maß-/Erprobungs-/Verlaufsblatt bearbeiten, (7) speichern, neu laden und Datenerhalt kontrollieren, (8) Abschlussvoraussetzungen prüfen, (9) geschützt archivieren, in Archivübersicht suchen und – mit synthetischem Fall – Integrität und Wiederherstellung prüfen.

| ID | PG | Besonderer Prüffall | Erwartetes Verhalten | Freigabe |
| --- | --- | --- | --- | --- |
| P23-1 | 23 | Untere Extremität, Neutral-Null/Janda | Nur passende untere Extremitätsfelder; anwendbare Felder Pflicht | Produktiv |
| P23-2 | 23 | Rumpf / Wirbelsäule statt untere Extremität | Cobb-/Rumpffelder statt untere Felder; alte konditionale Werte werden entfernt | Produktiv |
| P23-3 | 23 | Sonderanfertigung: konfektionierte Orthese = Nein | Begründung eingeblendet und erforderlich | Produktiv |
| P23-4 | 23 | Absatzhöhe / Schuhgröße ohne eindeutigen Trigger | Sichtbar als nicht blockierender Klärfall | Produktiv |
| P24-1 | 24 | AOK BW, Unterkiefer-/Unterschenkelprofil entsprechend der hinterlegten AOK-Quelle | Originalprofil und passendes Maßblatt statt fälschlich generischem Original | Produktiv |
| P24-2 | 24 | Nicht-AOK-Kasse und PG24 | Passender generischer/Technikerbogen; keine AOK-BW-Pflicht behaupten | Produktiv |
| P24-3 | 24 | Versorgungssituation / Amputationshöhe wechseln | Richtige Maßskizze und Felder; keine verdeckten Altwerte | Produktiv |
| P18-1 | 18 | E-Rollstuhl, Unterstell-/Lademöglichkeit | Bedingtes Pflichtfeld nur bei E-Versorgung | Nur Test |
| P18-2 | 18 | Erprobung ohne eindeutig kodierten Trigger | Fehlender Trigger transparent; keine erfundene automatische Pflicht | Nur Test |
| P26-1 | 26 | AOK PLUS Sitzschale | Nutzung, Einsatzsituationen, Nutzungsumfang, therapeutisches Umfeld Pflicht | Nur Test |
| P26-2 | 26 | GMFCS ohne neurologisch/pädiatrischen Trigger | Sichtbar, nicht blockierend, als offener Klärfall | Nur Test |
| P31-1 | 31 | DFS-Schuhe, DAF/Pedografie | Ohne kodierten DAF-Trigger sichtbar, nicht blockierend | Nur Test |
| P38-1 | 38 | Armprothese, Seite / Niveau / Maße | Stammdaten und betroffene Seite übernommen; Pflichtprüfung aktiv | Nur Test |
| P38-2 | 38 | Schädigungsart ohne strukturierte Optionen | Freitext statt erfundener Auswahlwerte | Nur Test |
| X-1 | alle | Kassenbogen ohne digitales Originalmapping | Als **digitale Voraufnahme** gekennzeichnet, keine Originalgleichheit behaupten | Querschnitt |
| X-2 | alle | Stammdaten/OCR und Wiederaufnahme | Keine doppelten Felder; Versichertennummer, Name und Geburtsdatum synchron | Querschnitt |
| X-3 | alle | Bezeichnung «Versorgungsart» | Keine pauschale Übernahme einer anders definierten Versorgungskategorie | Querschnitt |
| X-4 | alle | Abschluss und Archiv | Keine unsichtbaren Abrechnungs-/Kalkulationspflichten, geschütztes Archiv bleibt erreichbar | Querschnitt |
| X-5 | alle | Sichtbarkeitsgrenze | Neue Versorgung: ausschließlich PG23/24; PG26-Navigation verborgen; Bestandsdaten nicht gelöscht | Querschnitt |

## Ergebnisprotokoll

Diese Matrix ist ein **Testplan, kein Nachweis bestandener End-to-End-Tests**. Für jede Zeile vor Freigabe festhalten: Datum, Branch/Commit, Testumgebung, synthetische Testfall-ID, Ergebnis (PASS/FAIL/BLOCKED), Screenshot/Protokoll, Ticket bei FAIL. Datenbank- und R2-Archivtests benötigen getrennte, gegen Produktion isolierte Testressourcen.

## Priorität

- **P0:** PG23/24 vollständige Durchläufe mit Datenpersistenz und Archiv; Browser-Regressionslauf; Sichtbarkeitsgrenze; keine patientenbezogenen Testdaten.
- **P1:** PG18/26/31/38 isolierte Fachtests und strukturierte Bedingungen; fehlende Kassenbogen-Mappings aus Originalquellen.
- **P2:** weitere PG-Strukturierung, Komfort und geführte Spracheingabe.

Referenz: `docs/ANAMNESE_AUDIT_V0_9.md`.
