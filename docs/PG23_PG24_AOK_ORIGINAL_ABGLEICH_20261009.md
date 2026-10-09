# PG23/PG24 – Quellformular-Abgleich AOK Baden-Württemberg (09.10.2026)

## Zweck und Quellenstatus
Die fachliche digitale Voraufnahme ist nicht gleichbedeutend mit der Ausgabe eines vertragskonformen Originals. Die konkrete Vertragsfassung ist **vor** einer automatischen Formularzuordnung festzustellen.

- **PG23:** Hinterlegter `FO_PG23_AOK-Bogen untere Extremität.pdf` nennt im Titel Anlage 3a, Inkrafttreten 15.09.2023, AC/TK 15/16/19 01 723, mit internem FO-Footer vom 06.02.2024. Parallel veröffentlicht die AOK BW einen **eigenständigen** Verbandsvertrag mit Inkrafttreten 01.07.2026 (AC/TK 1X 01 K23 / L23). Dessen Zuordnung richtet sich laut AOK nach dem Verordnungsdatum. Die Varianten dürfen nicht ohne Vertrags-/Beitrittsprüfung zusammengeführt werden.
- **PG24:** Vorgelegter Vertrag und Anlagen gültig ab 01.09.2026, AC/TK 15 01 324. Im Original der Anlage 4 sind auf Seite 1 E1-E27 und auf Seite 4 E72-E73 sowie zwei Unterschriftenbereiche. Bei beidseitiger Amputation verlangt Seite 1 E3 einen **separaten** Profilbogen für die zweite Seite.
- Die E-Mail-Rückmeldung der AOK BW vom 01.10.2026 präzisiert für die Vertragsanlagen 2–10: Layout darf abweichen, die Inhalte müssen aber vollständig und ohne Ergänzungen wiedergegeben werden.

Amtliche Vertragsübersichten:
- PG23 FOS 2023: https://www.aok.de/gp/vertraege/hilfsmittelversorgung/orthopaedie-und-rehatechnik/pg-23-orthesen/fos
- PG23 Verband 2026: https://www.aok.de/gp/vertraege/hilfsmittelversorgung/orthopaedie-und-rehatechnik/pg-23-orthesen/verband6
- PG24 2026: https://www.aok.de/gp/orthopaedie-rehatechnik/vertraege/pg24-beinprothesen

## Inventur der vorgelegten, lokal überprüften PDF-Formularfelder

| Formular / PDF | Seiten | PDF-Widgets | Status |
| --- | ---: | ---: | --- |
| PG23 AOK 2023 – Anlage 3a, untere Extremität (interne FO-Fassung) | 3 | 152, davon 144 eindeutige Namen | **Achtung:** acht doppelt benannte Widgets; nicht ausschließlich mit Feldnamen adressieren |
| PG24 Anlage 2 eKVA | 2 | 0 | nicht interaktiv; Druck-/Originalprüfung erforderlich |
| PG24 Anlage 3 Versorgungsdokumentation | 2 | 41 | Semantik noch feldweise offen |
| PG24 Anlage 4 Profilerhebungsbogen | 4 | 213 | 11 Zuordnungen direkt gegen Quelllayout geprüft |
| PG24 Anlage 5a Fuß | 1 | 27 | Semantik noch feldweise offen |
| PG24 Anlage 5b Unterschenkel | 2 | 42 | Semantik noch feldweise offen |
| PG24 Anlage 5c Knieex | 2 | 40 | Semantik noch feldweise offen |
| PG24 Anlage 5d Oberschenkel | 2 | 36 | Semantik noch feldweise offen |
| PG24 Anlage 5e Hüftex | 2 | 56 | Semantik noch feldweise offen |
| PG24 Anlage 7 Einwilligung Bild/Video | 2 | 9 | keine Änderung am Erklärungstext |
| PG24 Anlage 8 Mehrkosten | 2 | 22 | keine Änderung am Erklärungstext |
| PG24 Anlage 9 Empfangsbestätigung | 2 | 8 | Semantik noch feldweise offen |

Die Widgets der PG24-Anlage 4 heißen oft nur `Text1`, `Check Box1` usw. **Nur die unten als verifiziert markierten Zuordnungen** dürfen ohne erneute Quellprüfung als semantisch bestimmt gelten. Alle übrigen geometrisch erkannten Nachbartexte sind heuristisch; kein eindeutiges Ziel für Spracherkennung/OCR.

## PG24 Anlage 4: geprüfte Kernzuordnungen

| Seite | PDF-ID | Im Original sichtbare Feldbedeutung | Fachlogik |
| --- | --- | --- | --- |
| 1 | Text1 | Grund der Vorstellung | Stammdatenvorbelegung, manuell korrigierbar |
| 1 | Text2 | Vorname, Name, Geburtsdatum bzw. Adressaufkleber | Stammdatenvorbelegung (Geburtsdatum gesondert prüfen) |
| 1 | Text3 | Körpergröße in m | klinisches Messfeld |
| 1 | Text4 | Körpergewicht in kg | klinisches Messfeld |
| 1 | Text5 | verordnende Arztpraxis (Name, Anschrift) | Rezept/Stammdaten, Prüfung |
| 1 | Text6 | Fachpraxis | Rezept/Stammdaten, Prüfung |
| 2 | Text24 | PLUS-M Rohwert | berechnet |
| 2 | Text25 | PLUS-M T-Score | berechnet, nur bei 12 vollständigen Items |
| 2 | Text26 | primär verwendete Gehhilfe | originaler Freitext |
| 4 | Text67 | **Datum der Hilfsmittelanbieter-Unterschriftszeile** | **kein Unterschriftsfeld** |
| 4 | Text69 | Unterschrift, Stempel Hilfsmittelanbieter | digital signierbar |

Auf Seite 4 ist die Unterschriftslinie für Versicherte bzw. Bevollmächtigte nicht als PDF-Widget hinterlegt. Sie wird nur anhand der unveränderten gedruckten Bezeichnung als transparentes Signaturfeld überlagert. `Text67` darf sie nicht ersetzen.

## Abweichungen und Sicherheitsprinzipien
1. **PG23 FORM_022:** In `app_private.formularfelder` besitzt das Vertragsformular derzeit 0 zugeordnete Originalfelder. Die generische PG23-Voraufnahme ist deshalb **kein** ausgegebener AOK-Originalbogen. Vor Originalausgabe zusätzlich Vertragsfassung und Vertragspartner eindeutig zuordnen.
2. **PG24 FORM_046:** Auch hier 0 originäre `formularfelder`-Datensätze; das Original wird separat über PDF-Overlay gerendert. PDF-Widgetzahl belegt keine fachliche Pflichtfeldvollständigkeit.
3. **PG24 Bilateral:** Der zweite Original-Profilerhebungsbogen ist im Assistenten **noch nicht automatisch erzeugbar**. Sichtbarer Hinweis ist erforderlich; fachliche Freigabe bleibt blockiert bis ein belegbarer zweiter Originalbogen im Vorgang möglich ist.
4. **PG24 Unterschrift:** Das bisherige Mapping von `Text67` auf die Unterschrift der versicherten Person war falsch und wurde gegen das gerenderte Quellformular korrigiert.
5. **Originaltreue:** Zusätzliche interne Dokumentationsangaben müssen außerhalb der Vertragsoriginale liegen. Ungeprüfte Mapping-Heuristiken nicht als semantisch eindeutig kennzeichnen.

## Nächste P0-Abnahmepunkte
- Sämtliche bislang ungeprüften Original-Widget-Bedeutungen (Seite + Widgetposition + ID + Kontext) quellengetreu erheben; fachlich bestätigen, dann erst OCR-/Sprachtranskriptionsziele freigeben.
- Bilaterale PG24-Versorgung mit zwei unveränderten Originalbögen sicher speichern, ausgeben und wiederherstellen; Seiten getrennt kennzeichnen.
- AOK-PG23 Vertrags-/Gültigkeitsentscheidung je Vertragskennzeichen/Verordnungsdatum dokumentieren; gültige Anlage 3a/3b/3c/3d pro Himi tatsächlich bereitstellen.
- Druck/PDF einschließlich aller vier PG24-Seiten, Signatur/Unterschrift und Mehrseiten-Maßblätter in realer Browserumgebung mit synthetischen Versorgungen abnehmen.
- Keine produktiven Patientenvorgänge für Tests verwenden. Keine stillschweigenden juristischen Interpretationen in Formularregeln.
