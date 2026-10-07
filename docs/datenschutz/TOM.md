# Technische und organisatorische Maßnahmen (TOM)

Stand: 07.10.2026  
Status: technische Ist-Dokumentation mit Freigabepunkten

## Vertraulichkeit

Authentifizierung erfolgt über Supabase Auth. Produktiver Zugriff auf Patientenvorgänge erfordert MFA/AAL2. Zusätzlich muss der Benutzer in `app_private.app_members` aktiv freigegeben sein. Anonyme Konten werden ausgeschlossen. Die Patiententabelle `public.care_cases` nutzt Row Level Security; aktive Mitglieder mit MFA/AAL2 können Team-Vorgänge lesen, während Schreibzugriffe ownergebunden bleiben. `anon` besitzt keine Tabellenrechte.

Die fachliche Wissensdatenbank bleibt vom Patientenvorgang getrennt. Für die Wissensdaten gelten read-only-Berechtigungen; Patientenvorgänge liegen in einer separaten Schreibstruktur.

Rezeptbilder werden aktuell nicht dauerhaft gespeichert. OCR läuft lokal im Browser. Das reduziert die dauerhaft verarbeitete Datenmenge.

## Integrität

Änderungen an Patientenvorgängen erzeugen serverseitige Audit-Ereignisse. Zusätzlich werden vollständige Revisionsstände des fachlichen Payloads in einem nicht für Frontend-Rollen zugänglichen Schema gespeichert. Häufige Autosaves innerhalb derselben Bearbeitungssitzung werden zu einem aktuellen Snapshot zusammengefasst; Status-/Wizard-Wechsel und getrennte Sitzungen erzeugen neue Revisionen.

Governance-Felder wie Eigentümer, Erstellzeitpunkt, Legal Hold und Aufbewahrungssteuerung können nicht vom normalen Frontend-Benutzer überschrieben werden.

Direkte DELETE-Rechte für `authenticated` auf Patientenvorgänge sind entzogen. Löschung soll ausschließlich über einen kontrollierten administrativen Prozess nach Fristen- und Rechtsgrundlagenprüfung erfolgen.

## Externe Archivierung

Für vollständig bearbeitete eigene Vorgänge ist technisch eine optionale externe Archivierung über den Supabase-Backend-Dienst "archive-care-case" vorbereitet. Der Aufruf erfordert eine gültige Benutzer-Sitzung mit MFA/AAL2, aktive App-Mitgliedschaft und Eigentümerschaft am Vorgang. R2-Zugangsdaten befinden sich ausschließlich serverseitig.

Vor dem Upload wird der vollständige Fallstand persistiert. Der Archivdienst prüft serverseitig Abschlussmerkmale, begrenzt Request- und Archivgrößen, validiert Bildpfade gegen Eigentümer und Vorgangs-ID und führt eine private Archivindex-Tabelle mit Status PENDING/READY/FAILED. Wiederholte Aufrufe eines bereits READY archivierten Vorgangs erzeugen keine neue fachliche Archivversion. Der finale Statuswechsel auf "Abgeschlossen" erfolgt mit dem Benutzerkontext, damit Audit und last_modified_by dem ausführenden Benutzer zugeordnet bleiben.

Externe Archivobjekte sind Teil des Lösch- und Aufbewahrungskonzepts. Der lokale Purge ist fail-closed und verweigert die Löschung eines fälligen Falls, solange noch ein externer Archiveintrag oder zugehörige private Reparaturbilder bestehen. Die konkrete R2-Bucket-Konfiguration, Datenregion, Anbieterfreigabe und der kontrollierte Löschprozess des externen Archivs bleiben organisatorische Freigabepunkte.

## Verfügbarkeit und Wiederherstellbarkeit

Supabase übernimmt die Datenbankplattform. Backup-/Restore-Funktionen, konkrete Sicherungsintervalle und vertragliche Wiederherstellungsziele müssen entsprechend dem gebuchten Supabase-Tarif dokumentiert und regelmäßig getestet werden.

Für den Versorgungsassistenten ist mindestens jährlich sowie nach wesentlichen Architekturänderungen ein Wiederherstellungstest zu dokumentieren. Für produktive Nutzung ist festzulegen: RPO [einzutragen], RTO [einzutragen].

## Transport- und Speicherverschlüsselung

Die Anwendung kommuniziert über HTTPS/TLS. Patientenvorgänge werden nicht mehr regulär im Browser-`localStorage` gespeichert. Supabase dokumentiert Verschlüsselung und Sicherheitskontrollen seiner Plattform; die konkrete vertragliche Zusicherung ist über das gültige DPA/Leistungsbeschreibung zu dokumentieren.

Die ausführbaren Browser-Laufzeitabhängigkeiten werden seit 07.10.2026 beim GitHub-Pages-Build in das statische Site-Artefakt übernommen und anschließend same-origin ausgeliefert. Eine Content-Security-Policy erlaubt ausführbaren JavaScript-Code nur noch von der eigenen Origin; Remote-JavaScript-Imports und Inline-Scriptblöcke werden durch ein Deployment-Gate verhindert. OCR-Worker, Tesseract-Core/WASM, deutsches Sprachmodell, PDF.js und Supabase JS werden lokal aus dem Deployment ausgeliefert. Die Spracheingabe verwendet nun whisper.cpp/WebAssembly statt Transformers.js/ONNX: whisper.cpp wird aus einem fest gepinnten Upstream-Commit kompiliert, das multilinguale quantisierte Tiny-Q5_1-Modell wird per SHA-256 geprüft und zusammen mit der Laufzeit same-origin ausgeliefert. Die Inferenz läuft single-threaded in einem dedizierten Web Worker; dadurch sind keine SharedArrayBuffer-/Pthread- oder COOP/COEP-Sonderheader erforderlich. Audio wird für die Transkription nicht an einen externen Sprachdienst übertragen. Die frühere Transformers.js-Abhängigkeit wurde aus dem npm-Abhängigkeitsgraphen entfernt. Ein committed `package-lock.json` fixiert den verbleibenden npm-Abhängigkeitsgraphen; der Build verwendet `npm ci` und einen Critical-Security-Audit. Vor dem Pages-Deploy laufen automatisierte Browser-Regressionstests einschließlich OCR, PDF-Verarbeitung und lokaler whisper.cpp-Inferenz. Die Style-CSP ist ebenfalls gehärtet: statisches CSS liegt in `styles.css`, Inline-Styles und JavaScript-`.style`-Mutationen wurden entfernt, `style-src-attr 'none'` ist aktiv und `'unsafe-inline'` wird nicht mehr benötigt.

## Protokollierung

Protokolliert werden mindestens: Vorgangs-ID, Benutzer-ID, Zeitpunkt, INSERT/UPDATE/DELETE-Ereignis, Status vorher/nachher sowie geänderte fachliche Feldschlüssel. Zusätzlich werden vollständige Revisionsstände serverseitig abgelegt.

Auditdaten sind nicht über die normale Frontend-API für Anwender abrufbar. Zugriff ist ausschließlich administrativ und zweckgebunden zuzulassen.

## Mandanten-/Benutzertrennung

Aktuell gilt Team-Lesen bei weiterhin eigentümergebundener Bearbeitung. Dadurch ist Vertretung zur Einsicht möglich, ohne dass fremde Vorgänge verändert werden können. Eine spätere gemeinsame Bearbeitung benötigt eine gesonderte Rollen-/Übergabelogik und darf nicht durch pauschales Aufweichen der bestehenden Write-Policies erfolgen.

## Datenschutz durch Technikgestaltung

Datenminimierung: Rezeptdateien werden nicht dauerhaft gespeichert; nur erforderliche Fachinformationen werden übernommen.  
Zweckbindung: Patientendaten liegen getrennt von allgemeiner Wissensbasis.  
Default-Deny: `anon` ausgeschlossen; MFA/AAL2 verpflichtend.  
Nachvollziehbarkeit: serverseitiges Audit + Revisionshistorie.  
Löschschutz: keine Benutzer-Direktlöschung.  
Sitzungsschutz: Auth-Tokens werden nur in `sessionStorage` gehalten; nach 30 Minuten Inaktivität erfolgt automatische Abmeldung.

## Organisatorische Maßnahmen vor Produktivfreigabe

Verantwortliche Stelle und DSB benennen; Rollenfreigabeprozess dokumentieren; regelmäßige Berechtigungsrezertifizierung mindestens halbjährlich; Offboarding unverzüglich; Schulung der Anwender zum Umgang mit Gesundheitsdaten; Incident- und Datenschutzverletzungsprozess mit 72-Stunden-Prüfung nach Art. 33 DSGVO; dokumentiertes Patch-/Dependency-Management; jährliche TOM-/DSFA-Überprüfung; AVV/DPA-Prüfung für alle Auftragsverarbeiter; getestetes Löschverfahren; getestete Wiederherstellung.

## Offene technische Härtung

Der Supabase Security Advisor meldet aktuell nur noch den deaktivierten Schutz gegen kompromittierte Passwörter. Laut Supabase-Dokumentation ist die Leaked-Password-Protection erst ab Pro verfügbar und kann deshalb im Free-Plan nicht aktiviert werden. Als kompensierende technische Kontrollen bleiben MFA/AAL2 und die aktive Benutzerfreigabe verpflichtend. Die früheren Hinweise auf `pg_trgm` und `unaccent` im Schema `public` wurden am 07.10.2026 durch Verschieben in `extensions` beseitigt. Externe Laufzeitabhängigkeiten und GitHub-Pages-Eignung für den finalen Produktivbetrieb sind weiterhin gesondert zu entscheiden.
