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

## Browser-Laufzeitabhängigkeiten

Die produktiven Browser-Laufzeitbibliotheken werden im GitHub-Pages-Build fest versioniert bzw. reproduzierbar erzeugt und anschließend same-origin ausgeliefert. OCR, PDF-Verarbeitung und whisper.cpp/WebAssembly benötigen zur Laufzeit keinen externen JavaScript-CDN-Zugriff. Die verbleibenden Supply-Chain-Risiken werden durch Lockfile, Hashprüfungen, gepinnte Build-Actions, CSP und Browser-Regressionen reduziert.

## Optionales externes Langzeitarchiv (Cloudflare R2)

Für abgeschlossene Versorgungen ist technisch ein geschützter Backend-Dienst "archive-care-case" vorbereitet. Er kann den vollständigen Fallstand, Revisions- und Auditdaten sowie zugehörige Reparaturbilder in ein privates Cloudflare-R2-Objektarchiv übertragen. Der Browser erhält keine R2-Zugangsdaten; die Übertragung erfolgt ausschließlich serverseitig nach gültiger Supabase-Sitzung, MFA/AAL2, aktiver Mitgliedschaft und Eigentümerprüfung.

Zum Stand dieses Dokuments existiert noch kein erfolgreicher Archiveintrag in app_private.care_case_archives. Ob die R2-Zugangsdaten bereits produktiv hinterlegt sind, ist aus der Anwendung selbst nicht ableitbar.

Vor einer Aktivierung mit echten Gesundheitsdaten zwingend zu dokumentieren und freizugeben:
- Vertrags-/AVV- bzw. DPA-Einordnung von Cloudflare einschließlich Unterauftragsverarbeitern,
- Datenregion, mögliche Drittlandtransfers und Supportzugriffe,
- private Bucket-Konfiguration und administrative Zugriffskontrollen,
- Aufbewahrungs- und Löschprozess auch für die externen Archivobjekte,
- Wiederherstellungs-/Integritätsprüfung der Archive,
- Exit-/Datenrückgabeprozess bei Anbieterwechsel.

Der lokale Purge-Prozess ist technisch so gehärtet, dass eine fällige Versorgung nicht als vollständig gelöscht gelten kann, solange dazu noch ein externer Archiveintrag besteht.

## Freigabeprotokoll

Verantwortliche Stelle: [ ] geprüft  
Datenschutzbeauftragte/r: [ ] geprüft  
IT-Sicherheit: [ ] geprüft  
Supabase DPA wirksam einbezogen: [ ]  
Unterauftragsverarbeiter geprüft: [ ]  
GitHub/Produktivhosting entschieden: [ ]  
Cloudflare-R2-Archiv freigegeben oder deaktiviert: [ ]  
Drittlandtransferbewertung dokumentiert: [ ]  
Lösch-/Exit-Prozess einschließlich externer Archive getestet: [ ]
