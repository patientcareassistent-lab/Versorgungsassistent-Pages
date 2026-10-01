# Berechtigungs-, Aufbewahrungs- und Löschkonzept

Stand: 01.10.2026

## Rollenmodell

Tester: Nutzung der freigegebenen Anwendung und Bearbeitung eigener Test-/Versorgungsvorgänge.  
Editor: fachliche Pflegefunktionen nur, wenn hierfür später gesonderte Schreibpfade mit RLS eingerichtet werden. Aktuell bleibt die Wissensdatenbank für das Frontend read-only.  
Admin: organisatorische Benutzerfreigabe, Datenschutz-/Aufbewahrungsadministration und technisch notwendige Sonderfälle. Administrative Zugriffe dürfen nicht über normale Frontend-Rechte erfolgen.

Jeder Benutzer benötigt einen individuellen Account. Gemeinsame Konten sind unzulässig. MFA/AAL2 ist verpflichtend.

## Freigabe und Entzug

Freigabe erfolgt durch Aufnahme des Benutzer-UUID in `app_private.app_members` mit `active=true`. Der Zugriff ist nur für nicht-anonyme Konten möglich. Bei Rollenwechsel, Ausscheiden oder Verdacht auf Kompromittierung ist `active=false` unverzüglich zu setzen und die Auth-Sitzung zu widerrufen.

Berechtigungen sind mindestens halbjährlich und zusätzlich anlassbezogen zu rezertifizieren.

## Zugriff auf Patientenvorgänge

RLS-Prinzip: `owner_user_id = auth.uid()`.  
Zusatzbedingungen: aktives Mitglied, MFA/AAL2, nicht anonym.  
Kein `anon`-Zugriff.  
Kein direkter DELETE-Zugriff für normale Frontend-Benutzer.

Team-/Vertretungszugriff ist aktuell bewusst nicht umgesetzt. Er darf später nur über explizite Fallzuordnung und dokumentierte Rollen eingeführt werden.

## Aufbewahrung

Die Datenbank führt `completed_at`, `retention_until`, `retention_basis`, `legal_hold` und `erasure_requested_at`.

Aktueller technischer Standard-ENTWURF: Bei Abschluss wird `retention_until = completed_at + 10 Jahre` gesetzt. Hintergrund ist insbesondere § 630f Abs. 3 BGB, sofern der jeweilige Versorgungsvorgang als Behandlungsdokumentation einzustufen ist. Diese Annahme ist vor Produktivfreigabe durch die verantwortliche Stelle/DSB bzw. Rechtsberatung zu bestätigen. Vertrags- oder kassenbezogene Fristen können abweichen.

## Löschung

Eine Löschung darf nur erfolgen, wenn:
- die festgelegte Aufbewahrungsfrist abgelaufen ist,
- kein Legal Hold besteht,
- keine laufende Prüfung, Reklamation, Abrechnung, Haftungs-/Gewährleistungsfrage oder Rechtsverteidigung die weitere Speicherung rechtfertigt,
- keine speziellere gesetzliche oder vertragliche Aufbewahrungspflicht entgegensteht.

Der Löschlauf muss protokolliert werden. Vor automatischer Produktivlöschung ist ein dokumentierter Test mit nicht-produktiven Daten erforderlich.

## Betroffenenrechte

Auskunft, Berichtigung, Einschränkung und Löschung sind organisatorisch zu bearbeiten. Bei Berichtigung fachlicher Dokumentation ist die Revisionshistorie zu erhalten, soweit dies zur gesetzlichen Nachweispflicht erforderlich ist. Ein Löschbegehren führt nicht automatisch zur sofortigen physischen Löschung, wenn gesetzliche Aufbewahrungspflichten entgegenstehen; in diesem Fall ist die Verarbeitung auf den zulässigen Zweck zu beschränken.

## Audit und Revision

`app_private.care_case_audit`: Ereignisprotokoll ohne vollständige Nutzdatenkopie.  
`app_private.care_case_revisions`: vollständige fachliche Payload-Revisionsstände zur Nachvollziehbarkeit von Änderungen.

Audit-/Revisionsdaten sind nicht für den normalen Benutzerzugriff freigegeben und werden grundsätzlich zusammen mit dem zugrunde liegenden Vorgang bzw. gemäß gesondert bestätigter Nachweisfrist gelöscht.
