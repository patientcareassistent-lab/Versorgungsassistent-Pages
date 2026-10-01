# AVV/DPA- und Dienstleisterprüfung

Stand: 01.10.2026

## Supabase

Rolle: Hosting, Authentifizierung, Datenbank und Plattformdienste; je nach Vertragskonstellation Auftragsverarbeiter bzw. Unterauftragsverarbeiter.

Aktuelles Supabase Data Processing Addendum: Version 1, 01.08.2026. Das DPA beschreibt Supabase als Processor/Service Provider für Covered Data und enthält Regelungen für internationale Transfers einschließlich Standardvertragsklauseln, soweit erforderlich.

Vor Produktivfreigabe zu dokumentieren:
- Vertragspartner und verantwortliche Stelle
- wirksame Einbeziehung/Annahme des aktuellen DPA
- Projektregion `eu-central-1`
- Liste der Unterauftragsverarbeiter
- Support-/Administrationszugriffe und mögliche Drittlandtransfers
- Löschung/Rückgabe von Daten bei Vertragsende
- Backup-/Wiederherstellungsumfang
- Meldewege bei Sicherheitsvorfällen
- Nachweise/Zertifizierungen entsprechend dem gebuchten Angebot

Offizielle Quelle: https://supabase.com/legal/customer-resources/data-processing-addendum

## GitHub Pages

Rolle im aktuellen Projekt: Auslieferung des statischen Frontends. Patientennutzdaten werden nicht im GitHub-Repository gespeichert.

Trotzdem entstehen beim Abruf einer Website regelmäßig technische Verbindungsdaten beim Hostinganbieter. Vor Produktivbetrieb mit echten Patientendaten ist zu entscheiden, ob GitHub Pages als Frontend-Hosting im Risikoprofil und Vertragsrahmen akzeptiert wird. Eine Freigabe sollte insbesondere Hosting-/Logdaten, DPA/Datenschutzbedingungen, Unterauftragsverarbeiter, Drittlandbezug und Incident-Prozess berücksichtigen.

Empfehlung für den Produktivbetrieb: Hosting unter einer kontrollierten Unternehmens-/EU-Infrastruktur oder eine ausdrücklich für Gesundheitsdaten freigegebene Hostinglösung prüfen.

## Externe JavaScript-/OCR-Abhängigkeiten

Der aktuelle Frontendcode lädt Laufzeitbibliotheken extern. Da fremder JavaScript-Code im Kontext der Anwendung ausgeführt wird, ist dies ein Supply-Chain-Risiko. Vor Produktivfreigabe sollen kritische Bibliotheken möglichst selbst gehostet, fest versioniert, integritätsgeprüft und über restriktive Content-Security-Policy abgesichert werden.

## Freigabeprotokoll

Verantwortliche Stelle: [ ] geprüft  
Datenschutzbeauftragte/r: [ ] geprüft  
IT-Sicherheit: [ ] geprüft  
Supabase DPA wirksam einbezogen: [ ]  
Unterauftragsverarbeiter geprüft: [ ]  
GitHub/Produktivhosting entschieden: [ ]  
Drittlandtransferbewertung dokumentiert: [ ]  
Lösch-/Exit-Prozess getestet: [ ]
