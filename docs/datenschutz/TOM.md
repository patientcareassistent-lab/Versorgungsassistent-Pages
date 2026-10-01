# Technische und organisatorische Maßnahmen (TOM)

Stand: 01.10.2026  
Status: technische Ist-Dokumentation mit Freigabepunkten

## Vertraulichkeit

Authentifizierung erfolgt über Supabase Auth. Produktiver Zugriff auf Patientenvorgänge erfordert MFA/AAL2. Zusätzlich muss der Benutzer in `app_private.app_members` aktiv freigegeben sein. Anonyme Konten werden ausgeschlossen. Die Patiententabelle `public.care_cases` nutzt Row Level Security; ein Benutzer sieht nur eigene Vorgänge. `anon` besitzt keine Tabellenrechte.

Die fachliche Wissensdatenbank bleibt vom Patientenvorgang getrennt. Für die Wissensdaten gelten read-only-Berechtigungen; Patientenvorgänge liegen in einer separaten Schreibstruktur.

Rezeptbilder werden aktuell nicht dauerhaft gespeichert. OCR läuft lokal im Browser. Das reduziert die dauerhaft verarbeitete Datenmenge.

## Integrität

Änderungen an Patientenvorgängen erzeugen serverseitige Audit-Ereignisse. Zusätzlich wird nach jedem Insert/Update ein vollständiger Revisionsstand des fachlichen Payloads in einem nicht für Frontend-Rollen zugänglichen Schema gespeichert.

Governance-Felder wie Eigentümer, Erstellzeitpunkt, Legal Hold und Aufbewahrungssteuerung können nicht vom normalen Frontend-Benutzer überschrieben werden.

Direkte DELETE-Rechte für `authenticated` auf Patientenvorgänge sind entzogen. Löschung soll ausschließlich über einen kontrollierten administrativen Prozess nach Fristen- und Rechtsgrundlagenprüfung erfolgen.

## Verfügbarkeit und Wiederherstellbarkeit

Supabase übernimmt die Datenbankplattform. Backup-/Restore-Funktionen, konkrete Sicherungsintervalle und vertragliche Wiederherstellungsziele müssen entsprechend dem gebuchten Supabase-Tarif dokumentiert und regelmäßig getestet werden.

Für den Versorgungsassistenten ist mindestens jährlich sowie nach wesentlichen Architekturänderungen ein Wiederherstellungstest zu dokumentieren. Für produktive Nutzung ist festzulegen: RPO [einzutragen], RTO [einzutragen].

## Transport- und Speicherverschlüsselung

Die Anwendung kommuniziert über HTTPS/TLS. Patientenvorgänge werden nicht mehr regulär im Browser-`localStorage` gespeichert. Supabase dokumentiert Verschlüsselung und Sicherheitskontrollen seiner Plattform; die konkrete vertragliche Zusicherung ist über das gültige DPA/Leistungsbeschreibung zu dokumentieren.

Die Anwendung verwendet derzeit externe JavaScript-Abhängigkeiten. Für Produktivbetrieb mit echten Patientendaten ist die Abhängigkeitssicherheit zu prüfen; bevorzugt sollen kritische Laufzeitabhängigkeiten selbst gehostet oder anderweitig gegen Supply-Chain-Manipulation abgesichert werden.

## Protokollierung

Protokolliert werden mindestens: Vorgangs-ID, Benutzer-ID, Zeitpunkt, INSERT/UPDATE/DELETE-Ereignis, Status vorher/nachher sowie geänderte fachliche Feldschlüssel. Zusätzlich werden vollständige Revisionsstände serverseitig abgelegt.

Auditdaten sind nicht über die normale Frontend-API für Anwender abrufbar. Zugriff ist ausschließlich administrativ und zweckgebunden zuzulassen.

## Mandanten-/Benutzertrennung

Aktuell gilt Privacy-by-default: Vorgänge sind eigentümergebunden. Team-Sharing ist nicht freigeschaltet. Eine spätere gemeinsame Bearbeitung benötigt eine explizite Fallzuordnung/Rollenmatrix und darf nicht durch Aufweichen der bestehenden RLS erfolgen.

## Datenschutz durch Technikgestaltung

Datenminimierung: Rezeptdateien werden nicht dauerhaft gespeichert; nur erforderliche Fachinformationen werden übernommen.  
Zweckbindung: Patientendaten liegen getrennt von allgemeiner Wissensbasis.  
Default-Deny: `anon` ausgeschlossen; MFA/AAL2 verpflichtend.  
Nachvollziehbarkeit: serverseitiges Audit + Revisionshistorie.  
Löschschutz: keine Benutzer-Direktlöschung.

## Organisatorische Maßnahmen vor Produktivfreigabe

Verantwortliche Stelle und DSB benennen; Rollenfreigabeprozess dokumentieren; regelmäßige Berechtigungsrezertifizierung mindestens halbjährlich; Offboarding unverzüglich; Schulung der Anwender zum Umgang mit Gesundheitsdaten; Incident- und Datenschutzverletzungsprozess mit 72-Stunden-Prüfung nach Art. 33 DSGVO; dokumentiertes Patch-/Dependency-Management; jährliche TOM-/DSFA-Überprüfung; AVV/DPA-Prüfung für alle Auftragsverarbeiter; getestetes Löschverfahren; getestete Wiederherstellung.

## Offene technische Härtung

Supabase Security Advisor meldet aktuell unter anderem deaktivierten Schutz gegen kompromittierte Passwörter. Diese Einstellung ist im Supabase-Dashboard zu aktivieren, sofern im gebuchten Tarif verfügbar. Außerdem sind externe Laufzeitabhängigkeiten und GitHub-Pages-Eignung für den finalen Produktivbetrieb gesondert zu entscheiden.
