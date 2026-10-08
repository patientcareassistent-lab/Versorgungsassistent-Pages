# Funktionaler Anamnese-Audit – Version 0.9

Stand: 2026-10-08

## Zielbild 0.9

Version 0.9 dient im ersten Schritt der digitalen Ablösung der papierhaften Anamnese und Profilerhebung.

Bestandteil bleiben:
- Auftragserfassung und Patient-Stammdaten
- Rezept vorhanden / nicht vorhanden, lokale OCR und manuelle Korrektur
- Anamnese / Profilerhebung
- erforderliche Maßdokumentation
- fachliche Folge-/Erprobungs-/Abgabedokumentation, soweit der Versorgungspfad sie verlangt
- Druck / PDF
- Versorgungsübersicht
- Archivübersicht und geschützte Archivierung

Nicht sichtbar in 0.9:
- Abrechnung
- Kalkulation
- Preis-/Kalkulationsbausteine

Die Archivierung darf deshalb keine ausgeblendeten Abrechnungsfelder voraussetzen.

## Datenbestand

Die Datenbank enthält derzeit 18 Produktgruppen mit generischen Anamnesebögen und insgesamt 473 Formularfelder.

Wiederkehrende Pflicht-Stammdaten in den generischen Bögen:
- Versorgungsart: 19 Vorkommen, 19 Pflicht
- Geburtsdatum: 19 Vorkommen, davon 18 Pflicht
- Name, Vorname: 18 Pflicht
- Versichertennummer: 18 Pflicht
- Grund der Versorgung: 18 Pflicht
- versorgungsrelevante Diagnosen / Funktionseinschränkungen: 18 Pflicht
- Versorgungsziel: 18 Pflicht
- Körpergröße: 13 Pflicht
- Körpergewicht: 13 Pflicht

Es wurden keine doppelten Feldzeile-IDs gefunden.

40 Formularfelder sind als `bedingt` gekennzeichnet. Bedingungen werden nur automatisiert, wenn der hinterlegte Quellenkatalog einen eindeutigen Auslöser enthält. Fehlt ein eindeutiger Auslöser, bleibt das Feld sichtbar und nicht blockierend; die Oberfläche kennzeichnet diesen Zustand ausdrücklich.

## Strukturierte Hilfsmittellogik

Aktive Datensätze in `app_private.hilfsmittel_logik` bestehen derzeit für:
- PG05
- PG08
- PG18
- PG23
- PG26

Die übrigen Produktgruppen greifen derzeit noch auf die im Frontend vorhandene Hilfsmittel-Unterteilung zurück und laden den generischen PG-Bogen. Das funktioniert für die Anamnese, ist aber noch nicht vollständig datenbankzentriert.

## PG18 – Rollstuhl / Fahrzeuge

Umgesetzt:
- E-Rollstuhl erkennt die quellenbasierte Bedingung `Unterstell-/Lademöglichkeit – bei E-Versorgung`.
- Das Feld wird bei E-Versorgung eingeblendet und als erforderlich behandelt.
- Mehrfach-PG-Vertragsregeln, z. B. DAK oder KKH, werden jetzt für die enthaltene PG erkannt.
- BARMER PG18 besitzt eine vorhandene digitale Feldabbildung und wird über das bestehende Mapping verwendet.
- Kassenformulare ohne eigene Felddefinition werden ausdrücklich als allgemeine digitale Voraufnahme gekennzeichnet.

Noch nicht automatisiert:
- Erprobte Modelle, Erprobungsdatum/-dauer, Alltagserprobung und vorgeschlagenes Modell sind in Teilen als `bedingt` hinterlegt, ohne dass im generischen Datensatz ein eindeutiger maschinenlesbarer Auslöser angegeben ist. Es wird deshalb kein Trigger erfunden.

## PG23 – Orthesen

Umgesetzt:
- Anwendungsregion steuert quellengetreu:
  - untere Extremität
  - obere Extremität
  - Rumpf / Wirbelsäule
- Untere Extremität blendet u. a. Neutral-Null, Varus/Valgus, Genu recurvatum, Janda und kontralaterale Einschränkung ein.
- Obere Extremität blendet die entsprechende Neutral-Null-Erfassung ein.
- Rumpf / Wirbelsäule blendet Cobb-Winkel und Rumpfbefund ein.
- `Kann eine konfektionierte/teilkonfektionierte Orthese eingesetzt werden?` steuert bei `Nein` die Begründung der Sonderanfertigung.
- Die so ausgelösten Felder werden nur dann Pflicht.

Noch nicht automatisiert:
- Effektive Absatzhöhe und Schuhgröße sind als `bedingt` gekennzeichnet, jedoch ohne hinterlegten Auslöser. Sie bleiben sichtbar, aber nicht blockierend.

## PG26 – Sitzschalen

Umgesetzt:
- AOK-PLUS-Pflichtinhalte `Nutzung / Einsatzsituationen / täglicher Nutzungsumfang` sowie `Therapeutisches Umfeld` werden bei AOK PLUS eingeblendet und verpflichtend.
- Vertragsformulare ohne digitale Einzelfelder werden nicht als exakter digitaler Kassenbogen ausgegeben, sondern als Voraufnahme gekennzeichnet.
- Fehlende Auswahloptionen werden nicht erfunden. Statt eines leeren Dropdowns wird eine transparente Freitexteingabe verwendet.

Noch nicht automatisiert:
- GMFCS ist laut Quelle bei neurologischer/pädiatrischer Sitzschalenversorgung einzublenden. Im aktuellen Datenmodell gibt es keinen eindeutigen strukturierten Ja/Nein-Auslöser für „neurologisch/pädiatrisch“. Das Feld bleibt daher sichtbar und nicht blockierend, bis ein belastbarer Trigger hinterlegt ist.
- Das Pflichtfeld `Sitzschale / Sitzschale mit Untergestell` ist als Auswahl definiert, enthält aber keine einzeln hinterlegten Auswahlwerte. Die Oberfläche weist darauf hin und verwendet Freitext.

## PG31 – DFS-Schuhe

Umgesetzt:
- Generischer DFS-Anamnesebogen ist vollständig digital erfassbar.
- Pflichtfelder mit hinterlegten Optionen, z. B. Deformitäten und Vorversorgung, werden als echte Mehrfachauswahl dargestellt.
- Stammdaten werden aus der einmaligen Auftragserfassung übernommen.

Noch nicht automatisiert:
- Pedografie Neutralmessung: `bei DAF/erforderlicher Druckmessung`.
- Pedografie mit gefertigter DAF: `Druckreduktion dokumentieren`.
- Der Datensatz enthält derzeit keinen eindeutigen aktuellen DAF-/Druckmessungs-Trigger. Diese Felder bleiben deshalb sichtbar und nicht blockierend.
- Läsionsangaben sind als `bedingt` hinterlegt, aber ohne hinterlegten Auslöser.

## PG38 – Armprothesen

Umgesetzt:
- Generischer Armprothesenbogen wird digital abgebildet.
- Name, Geburtsdatum und Versichertennummer werden aus den Stammdaten gespiegelt.
- Pflichtfelder für Seite, Niveau, Befund, Funktion und prothesenspezifische Maße werden von der generischen Pflichtfeldprüfung erfasst.

Noch nicht automatisiert:
- `Datum / Ursache / Nachamputation` ist als `bedingt` markiert, jedoch ohne hinterlegten Auslöser.
- `Amputation / angeborene Fehlbildung` ist als Pflicht-Auswahl definiert, aber die Quelle enthält keine einzeln strukturierten Auswahlwerte. Es wird daher Freitext verwendet, statt Optionen zu erfinden.

## Formular- und Kassenlogik

Die Katalogtabelle `formulare` enthält zahlreiche kassenbezogene Einträge wie `EXPLIZIT_PFLICHT`, `VERTRAGSFORMULAR`, `INHALT_PFLICHT_FORMAT_FREI`, `PFLICHT_AUF_ANFORDERUNG` und `VERTRAG_PRUEFEN`.

Die `FORM_...`-Katalogeinträge besitzen aktuell selbst keine direkt zugeordneten Datensätze in `formularfelder`. Wo eine belastbare digitale Abbildung vorhanden ist, wird diese verwendet, z. B. bestehende BARMER-Mappings oder die spezielle PG24-AOK-Logik. Andernfalls wird der generische PG-/Hilfsmittelbogen nur als digitale Voraufnahme gezeigt und klar so gekennzeichnet.

Mehrfach-PG-Angaben wie `11/18/23/24/26/31`, `18/22` oder `19/50` werden jetzt als tatsächliche PG-Zuordnungen ausgewertet und nicht mehr als einzelner String behandelt.

## Stammdaten nur einmal erfassen

Zentral erfasst bzw. übernommen werden:
- Vorname
- Nachname
- Geburtsdatum
- Versichertennummer
- Versorgungsart
- betroffene Seite, soweit erforderlich

Die Versichertennummer kann vor der Rezeptaufnahme leer bleiben und durch die lokale OCR ergänzt werden. Beim Anzeigen eines Anamnesebogens werden vorhandene Stammdaten in gleichbedeutende Formularfelder gespiegelt. Varianten wie `Versichertennummer`, `KV-Nummer` und `KV.-Nr.` werden berücksichtigt.

Die fallbezogene Auswahl des konkreten Anamnesebogens wird inzwischen im Vorgang gespeichert und geht beim Autosave nicht mehr verloren.

## Archivierung

Archivübersicht und Archivieren bleiben Bestandteil von 0.9.

Frontend:
- Archivierung ist nur für eigene bearbeitbare Vorgänge möglich.
- Der Button ist erst aktiv, wenn alle für den konkreten sichtbaren v0.9-Pfad erforderlichen Schritte vollständig sind.
- Der ausgeblendete Abrechnungsschritt wird nicht berücksichtigt.

Backend:
- Abrechnungsstatus, Abrechnungsposition und VWKZ sind keine Archivierungsvoraussetzung.
- Der letzte sichtbare v0.9-Schritt ist maßgeblich.
- Kernangaben, Rezeptstatus, Reparatur-/Planungsangaben, Genehmigungsstand und Abgabe werden zusätzlich serverseitig geprüft.
- R2/Gateway-Archivierung und Prüfsummenprüfung bleiben erhalten.

## Offene Maßnahmen

### P0 / vor Freigabe 0.9
1. Browser-Regressionslauf für die gesamte aktuelle Hauptversion vollständig grün abschließen.
2. Je einen vollständigen Testfall für PG18, PG23, PG26, PG31 und PG38 durchspielen: Auftrag → Rezept → Profil → ggf. Maß → Dokumentation → Archiv.
3. Archivierten synthetischen Testfall in der Archivübersicht finden und Wiederherstellung/Verifikation prüfen.

### P1 / Datenqualität
1. Exakte digitale Felddefinitionen für die kassenbezogenen `FORM_...`-Einträge ergänzen, soweit die Originalquelle vorliegt.
2. Die noch frontendseitige Hilfsmittel-Unterteilung der PG04, 10, 11, 15, 17, 20, 22, 24, 28, 31, 32, 33 und 38 kontrolliert in `hilfsmittel_logik` überführen.
3. Bedingungslogik künftig strukturiert speichern, statt sie ausschließlich aus Freitext `Bedingung_UI` abzuleiten.
4. Für PG26 einen belastbaren Trigger für neurologisch/pädiatrisch hinterlegen, bevor GMFCS automatisch verpflichtend wird.
5. Für PG31 einen strukturierten Trigger für DAF / erforderliche Druckmessung hinterlegen.
6. Für PG38 die Quelle um strukturierte Werte für Schädigungsart und ggf. den Auslöser der Amputationsangaben ergänzen.

### P2 / Komfort
1. Weitere wiederkehrende Stammdaten nur einmal erfassen und in Kassenbögen spiegeln, wenn die Quellen dieselbe Bedeutung eindeutig bestätigen.
2. Lange Erhebungsbögen nach Abschnitten gruppieren, ohne die fachliche Reihenfolge der Quelle zu verändern.
3. Geführte Spracheingabe gezielt an noch offene Pflichtfelder koppeln.
