# Datenschutz-Folgenabschätzung (DSFA) – Versorgungsassistent

Stand: 01.10.2026  
Status: Entwurf, formale Freigabe durch Verantwortliche/n und Datenschutzbeauftragte/n erforderlich

## 1. Notwendigkeit

Die Anwendung verarbeitet Gesundheitsdaten und weitere besonders schützenswerte Versorgungsinformationen. Sie strukturiert und dokumentiert Versorgungsvorgänge und unterstützt fachliche Entscheidungen. Wegen Art, Kontext und Sensitivität der Daten wird vorsorglich von einem hohen Risiko ausgegangen und eine DSFA durchgeführt. Art. 35 DSGVO nennt insbesondere die umfangreiche Verarbeitung besonderer Kategorien personenbezogener Daten als Fallgruppe. Die Aufsichtsbehörden nennen Gesundheitsdaten und weitere höchst persönliche Daten als relevantes Risikomerkmal.

## 2. Verarbeitung

Datenfluss:
1. Mitarbeiter meldet sich mit Benutzername/Passwort und MFA an.
2. Server prüft aktive Mitgliedschaft.
3. Fachliche Referenzdaten werden read-only aus Supabase geladen.
4. Patient-/Versorgungsdaten werden im Browser erfasst.
5. Rezeptfoto/PDF wird aktuell nur lokal für OCR verarbeitet und nicht dauerhaft gespeichert.
6. Fachlicher Text und Vorgangsdaten werden über TLS in `public.care_cases` gespeichert.
7. RLS begrenzt Zugriff auf den jeweiligen Eigentümer.
8. Änderungen erzeugen Audit- und Revisionsdaten im privaten Schema.
9. Bei Abschluss wird eine Aufbewahrungsfrist vorgemerkt; Löschung erfolgt kontrolliert nach Freigabe des Löschkonzepts.

## 3. Erforderlichkeit und Verhältnismäßigkeit

Der Zweck kann nicht ohne personenbezogene Zuordnung erfüllt werden, da konkrete Versorgungen bearbeitet werden. Datenfelder sind auf fachlich erforderliche Angaben zu begrenzen. Rezeptbilder werden aktuell nicht dauerhaft gespeichert. Wissensdatenbank und Patientenvorgänge sind technisch getrennt.

Vor Produktivfreigabe muss die verantwortliche Stelle für jede Datenkategorie prüfen, ob sie für Versorgung, Abrechnung, Dokumentation oder gesetzliche Pflichten erforderlich ist.

## 4. Hauptrisiken

Unbefugter Zugriff auf Gesundheitsdaten; Kontoübernahme; fehlerhafte Rechtevergabe; XSS/Supply-Chain-Manipulation im statischen Frontend; Verlust oder unzulässige Veränderung von Versorgungsdokumentation; zu lange oder zu kurze Speicherung; unzulässige Weitergabe; fehlerhafte OCR, die fachlich ungeprüft übernommen wird; fehlende Nachvollziehbarkeit von Änderungen; Zugriff bei Geräteverlust; Drittland-/Subprozessor-Risiken.

## 5. Maßnahmen

MFA/AAL2; individuelle Accounts; Allowlist; RLS; kein anonymer Zugriff; Eigentümerbindung; Trennung der fachlichen Wissensdaten von Patientendaten; serverseitiges Audit; vollständige Revisionsstände; kein Frontend-DELETE; serverseitig geschützte Governance-Felder; TLS; Plattformverschlüsselung at rest; lokale OCR ohne dauerhafte Rezeptbildspeicherung; Pflicht zur manuellen Prüfung des OCR-Ergebnisses; Aufbewahrungsmetadaten und Legal-Hold-Feld; DPA-/Subprozessorprüfung; regelmäßige Berechtigungsrezertifizierung; Incident-Management; Backup-/Restore-Test.

## 6. Restrisiken und Produktivfreigabe

Folgende Punkte sind vor echter Patientennutzung verbindlich zu schließen oder zu akzeptieren:
- Verantwortliche Stelle, DSB und Rechtsgrundlagen eintragen/freigeben.
- Endgültige Lösch-/Aufbewahrungsfristen bestätigen.
- Supabase-DPA/AVV und Unterauftragsverarbeiter prüfen/akzeptieren.
- GitHub Pages als Produktivhoster datenschutzrechtlich und sicherheitstechnisch freigeben oder durch geeigneteres Hosting ersetzen.
- Externe JavaScript-Laufzeitabhängigkeiten selbst hosten oder mit einem gleichwertigen Supply-Chain-Schutz versehen.
- Schutz gegen kompromittierte Passwörter in Supabase aktivieren, sofern verfügbar.
- Backup-/Restore-Ziele und Tests dokumentieren.
- Rollen-/Vertretungsmodell für Mehrbenutzerbearbeitung festlegen, falls benötigt.
- Datenschutzinformationen nach Art. 13/14 DSGVO bereitstellen.
- Prozess für Betroffenenrechte und Datenschutzverletzungen organisatorisch freigeben.

## 7. Bewertung

Mit den implementierten Kontrollen ist das Risiko gegenüber dem ursprünglichen Browser-LocalStorage-Stand deutlich reduziert. Eine formale Produktivfreigabe wird erst nach Schließen bzw. dokumentierter Akzeptanz der in Abschnitt 6 genannten Restrisiken empfohlen.

Falls nach Abschluss der Maßnahmen weiterhin ein hohes, nicht ausreichend gemindertes Risiko besteht, ist vor Verarbeitung eine vorherige Konsultation der zuständigen Aufsichtsbehörde nach Art. 36 DSGVO zu prüfen.
