# Verzeichnis der Verarbeitungstätigkeiten – Versorgungsassistent

Stand: 01.10.2026  
Status: Entwurf zur Freigabe nach Art. 30 DSGVO

## Verantwortlicher

Verantwortliche Stelle: [einzutragen]  
Anschrift: [einzutragen]  
Datenschutzbeauftragte/r: [einzutragen]  
Fachverantwortung: [einzutragen]

## Verarbeitungstätigkeit

Bezeichnung: Digitale Unterstützung der Hilfsmittel-/Prothesenversorgung

Zwecke:
- Anlage und Bearbeitung eines Versorgungsvorgangs
- Erfassung von Patienten-/Versichertendaten
- Erfassung und Prüfung von Verordnungsinformationen
- fachliche Steuerung nach Produktgruppe, Hilfsmittel, Krankenkasse und Versorgungssituation
- Dokumentation von Profilerhebung, Maßdaten, Versorgungsverlauf, Erprobung, Abgabe und Abschluss
- Nachweis von Bearbeitungsschritten und Änderungen
- Vorbereitung von Genehmigungs-, Abrechnungs- und Dokumentationsprozessen

## Betroffene Personengruppen

Versicherte/Patientinnen und Patienten, deren Versorgung durch die verantwortliche Stelle bearbeitet wird.

## Datenkategorien

Stammdaten: Vorname, Nachname, Versichertennummer, Vorgangsnummer.  
Leistungs-/Vertragsdaten: Krankenkasse, Produktgruppe, Hilfsmittel, Versorgungsart, Genehmigungs- und Abrechnungsstatus.  
Gesundheitsdaten: Verordnungstext, Diagnose-/Befundinformationen, Profilerhebungsdaten, Maßdaten, Funktions-/Erprobungsdaten, Abgabe- und Versorgungsverlauf.  
Nutzungs-/Auditdaten: Benutzer-ID, Zeitpunkte, Statuswechsel, geänderte Datenfelder, Revisionsstände.

Rezeptbilder werden im aktuellen Stand nicht dauerhaft gespeichert.

## Rechtsgrundlage

Die konkrete Rechtsgrundlage ist durch die verantwortliche Stelle vor Produktivfreigabe verbindlich festzulegen. Je nach Versorgung kommen insbesondere Art. 6 Abs. 1 lit. b und/oder c DSGVO sowie für Gesundheitsdaten Art. 9 Abs. 2 lit. h DSGVO in Verbindung mit dem einschlägigen nationalen Recht in Betracht. Für Leistungserbringer sind insbesondere Aufzeichnungs- und Übermittlungspflichten aus SGB V §§ 294 und 302 zu prüfen. Soweit der Vorgang zugleich Behandlungsdokumentation darstellt, ist BGB § 630f zu berücksichtigen.

Einwilligung darf nur dann als Rechtsgrundlage verwendet werden, wenn sie für den jeweiligen Zweck tatsächlich freiwillig, informiert und widerruflich ist und keine vorrangige gesetzliche/vertragliche Grundlage besteht.

## Empfänger und Auftragsverarbeiter

Intern: nur berechtigte Mitarbeitende nach Rollen-/Berechtigungskonzept.  
Supabase: Hosting/Datenbank/Auth als Auftragsverarbeiter bzw. Unterauftragsverarbeiter entsprechend Vertragskonstellation.  
GitHub Pages: Auslieferung des statischen Frontends; keine absichtliche Speicherung von Patientennutzdaten im Repository. Zugriffs-/Telemetriedaten des Hostingdienstes sind separat zu bewerten.  
Krankenkassen/sonstige Empfänger: nur soweit für Versorgung, Genehmigung, Abrechnung oder gesetzliche Pflichten erforderlich.

## Drittlandübermittlung

Supabase-Projektregion ist `eu-central-1`. Trotzdem sind DPA, Unterauftragsverarbeiter und mögliche Support-/Administrationszugriffe zu prüfen. Das aktuelle Supabase DPA enthält Regelungen zu SCCs für relevante Drittlandtransfers.

## Löschung und Aufbewahrung

Aktive Vorgänge: Speicherung solange die Bearbeitung erforderlich ist.  
Abgeschlossene Vorgänge: technisch aktuell zehn Jahre ab Abschluss als Standard-ENTWURF. Die endgültige Frist muss je Datenkategorie und Rechtsgrundlage bestätigt werden. § 630f Abs. 3 BGB sieht für Behandlungsakten zehn Jahre nach Abschluss vor, soweit er anwendbar ist und keine andere Vorschrift eine andere Frist bestimmt.  
Audit-/Revisionsdaten: grundsätzlich an die Aufbewahrung des zugrunde liegenden Vorgangs koppeln; bei Rechtsstreit/Legal Hold keine automatisierte Löschung.

## Technische und organisatorische Maßnahmen

Siehe `TOM.md`.

## DSFA

Aufgrund der Verarbeitung von Gesundheitsdaten, der fachlichen Entscheidungsunterstützung und der systematischen digitalen Dokumentation wird eine DSFA als erforderlich behandelt. Siehe `DSFA_ENTWURF.md`.
