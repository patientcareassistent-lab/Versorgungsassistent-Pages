# PG24 AOK Baden-Württemberg – Feld- und Bedingungsabgleich (09.10.2026)

**Quellenstand:** Vertrag gemäß § 127 Abs. 1 SGB V, Produktgruppe 24, gültig ab 01.09.2026, AC/TK 15 01 324; aus `AOK PG24-20260901.zip` die unveränderten Anlagen 4 und 5a–5e.

## Verbindlichkeit – sorgfältig trennen

Die **sichtbare Formularzeile ist nicht automatisch ein Pflichtfeld**. Anlage 4, Seite 4 enthält ausdrücklich den Hinweis, dass die Erhebung/Verarbeitung auf freiwilliger Basis erfolgt. Die nur bei Vorliegen eines Befundes vorgesehenen `ja → spezifisch`-Eingaben sind **bedingte fachliche Dokumentationsaufforderungen**, aber ohne weiterführende Vertragsquelle keine pauschal zwingenden Eingaben aller Versorgungen.

Es wurden **414 PDF-Widgets** der bereitgestellten Quelldateien inventarisiert:

| Original | Seiten | PDF-Widgets | Einzelbedeutungen gegen Original geprüft |
| --- | ---: | ---: | --- |
| Anlage 4 Profilerhebung | 4 | 213 | 21; andere zunächst unverifiziert |
| Anlage 5a Fuß | 1 | 27 | diagrammbezogene Zuordnung noch offen |
| Anlage 5b UKB | 2 | 42 | diagrammbezogene Zuordnung noch offen |
| Anlage 5c Knieex | 2 | 40 | diagrammbezogene Zuordnung noch offen |
| Anlage 5d OKB | 2 | 36 | diagrammbezogene Zuordnung noch offen |
| Anlage 5e Hüftex | 2 | 56 | diagrammbezogene Zuordnung noch offen |

Die technische Vollmatrix mit Widget-ID, Dateihash, Seiten-/Koordinatenbezug, expliziter Verifikationsstufe und Quellenbedingungen wurde als gesonderter, patientenfreier JSON-/CSV-Export erstellt. Bei der online geladenen AOK-PDF können **AcroForm-Namen abweichen**; diese Export-Mappings nicht ungeprüft auf die Portaldatei übertragen.

## Originaltextgebundene Bedingungen (Abschnitt, Seite, Status)

| Quelle | Drucktext / Konsequenz | Einstufung | Stand der Anwendung |
| --- | --- | --- | --- |
| A4 E3, S.1 | Bei doppelseitiger Amputation extra Formular für zweite Seite | ausdrückliche Formularanweisung | zwei separate Originalbogeninstanzen implementiert / Browser-E2E erfolgreich |
| A4 E7, S.1 | Nachamputationen/Revisionen: `ja →` Art, Ort/Klinik, Zeitpunkt | bedingte Befunderläuterung | nur Quellhinweis, feldweise Bindung offen |
| A4 E14, S.1 | a-typische Stumpfform erläutern | bedingte Befunderläuterung | offen |
| A4 E21, S.1 | Volumenschwankungen: `ja → spezifisch` | bedingte Befunderläuterung | offen |
| A4 E23, S.1 | Hautzustand `auffällig → spezifisch` | bedingte Befunderläuterung | offen |
| A4 E25, S.1 | Sensibilität `vermindert → spezifisch` | bedingte Befunderläuterung | offen |
| A4 E27, S.1 | Weitere Auffälligkeiten → Beschreibung/Lokalisation/Ursache | bedingte Befunderläuterung | offen |
| A4 P25 / E47, S.2 | PLUS-M 12 Antworten, Rohwert/T-Score | Qualitätslogik: vollständiger Score | implementiert, nicht als generelle AOK-Pflicht behaupten |
| A4 E46, S.3 | **Gangbildbeobachtung optional** | ausdrücklich optional | nicht als Pflicht erzwingen |
| A4 E57, S.3 | Stumpfformung/Lymphmanagement `ja → spezifisch` | bedingte Befunderläuterung | offen |
| A4 E58, S.3 | Liner `ja →` Post-OP-Liner, Größe, Spezifikation; Maßdokumentation nach Anlagen 5 | bedingte Erfassung | offen |
| A4 E59, S.3 | Strumpfstrümpfe `ja → spezifisch` (wann, Anzahl, Art, Größe) | bedingte Erfassung | offen |
| A4 E60, S.3 | Endkontakt `teilweise/kein → spezifisch` | bedingte Befunderläuterung | offen |
| A4 E62, S.3 | Formausgleich `ja → spezifisch` | bedingte Befunderläuterung | offen |
| A4 E65, S.3 | Prothesenversorgung `nein → spezifisch` | bedingte Begründung | offen |
| A4 E73, S.4 | Derzeitige Versorgung `nein – wenn nein, welche Änderungen erforderlich` | bedingte Begründung | offen |
| A5a S.1 | Fußprothese: Hautmaße, Bemerkungen `Umfang Abweichung > 5%` | dokumentationsbezogener Hinweis | Original-PDF-Auswahl implementiert, Maßpunktzuordnung offen |
| A5b S.2 | `Bei Linerversorgung bitte Art und Material des Liners angeben` | ausdrücklicher bedingter Hinweis | Original-PDF integriert, Prüfung auf Nachtrag offen |
| A5d S.2 | `Bei Linerversorgung bitte Art und Material des Liners angeben` | ausdrücklicher bedingter Hinweis | Original-PDF integriert, Prüfung auf Nachtrag offen |
| A5c / A5e | originales Knieex- bzw. Hüftex-Maßblatt gemäß versorgtem Niveau | formularspezifische Auswahl | Original-PDF-Auswahl implementiert |

## Umsetzungsprinzip für nächste Änderung

1. Fachgruppe/Checkbox **nur dann** als eindeutiges Datenfeld oder gegenseitig ausschließend interpretieren, wenn jeder Widgetname **in der tatsächlich ausgelieferten PDF-Variante** anhand von Originaltext + Position bestätigt ist.
2. Bedingte Begründungsfelder erst nach belegter Zuordnung zwischen Auswahlwert und Textfeld aktiv pflichtprüfen; bis dahin nur Quellenhinweise anzeigen.
3. Klinische Auswahl *nicht* beliebig auf „zwingend“ hochstufen; keine zusätzlichen Vertragsformularfelder einfügen. Zusatzdaten außerhalb der Originalanlage halten.
4. Bei Anlagen 5a–5e sind die Maßzeichnungen bildlastig: erst Maßpunkt + Einheit + Körperseite + Versorgungsart + Originalseite prüfen.
5. Erhebung, Speicherung, Wiederaufnahme und PDF-Ausgabe für jeden Versorgungspfad mit ausschließlich synthetischen Fällen testen.

**Freigabestatus:** belastbare Quellmatrix / technisches Inventar, **keine** vollständige fachlich-rechtliche Vertragsabnahme. Zuordnung der offenen 393 Widgetbedeutungen und PG23-Vertragsvarianten bleibt P0 in Issue #20.
