# Datenschutzpaket Versorgungsassistent

Stand: 01.10.2026

Dieses Verzeichnis dokumentiert den Datenschutz- und Sicherheitsrahmen des Versorgungsassistenten. Die Unterlagen sind als Arbeits- und Freigabedokumente für Verantwortliche, Datenschutzbeauftragte, IT-Sicherheit und Fachverantwortliche gedacht.

## Aktueller technischer Stand

- Patientenvorgänge werden in Supabase in der Tabelle `public.care_cases` gespeichert.
- Zugriff ist nur für authentifizierte, in `app_private.app_members` freigegebene Benutzer mit MFA/AAL2 möglich.
- Row Level Security beschränkt jeden Benutzer auf die eigenen Vorgänge.
- `anon` hat keinen Zugriff auf Patientenvorgänge.
- Rezeptbilder werden derzeit nicht dauerhaft gespeichert. OCR erfolgt im Browser; gespeichert wird nur der erkannte bzw. korrigierte Text und Metadaten zur Erfassung.
- Alte lokale Browser-Entwürfe werden nach erfolgreicher MFA-Anmeldung einmalig in Supabase übernommen und erst nach erfolgreicher Migration aus `localStorage` gelöscht.
- Änderungen an Patientenvorgängen werden serverseitig in `app_private.care_case_audit` protokolliert.
- Vollständige Versionen des fachlichen Nutzdaten-Payloads werden serverseitig in `app_private.care_case_revisions` revisionsartig fortgeschrieben.
- Direkte Löschung von Patientenvorgängen durch Frontend-Benutzer ist gesperrt.
- Beim Status `Abgeschlossen` wird technisch eine Aufbewahrung von zehn Jahren als ENTWURF gesetzt. Die Rechtsgrundlage und ggf. abweichende kassen-/vertragsbezogene Fristen müssen vor Produktivfreigabe durch die verantwortliche Stelle bestätigt werden.
- Ein kontrollierter Löschlauf `app_private.purge_due_care_cases(...)` ist technisch vorbereitet, aber bewusst nicht für Frontend-Rollen freigegeben und nicht automatisch terminiert. Vor Aktivierung müssen die finalen Aufbewahrungsfristen bestätigt werden.

## Dokumente

- `VVT.md` – Entwurf Verzeichnis der Verarbeitungstätigkeiten
- `TOM.md` – technische und organisatorische Maßnahmen
- `BERECHTIGUNG_UND_LOESCHUNG.md` – Rollen-, Zugriffs-, Aufbewahrungs- und Löschkonzept
- `DSFA_ENTWURF.md` – Datenschutz-Folgenabschätzung
- `AVV_UND_DIENSTLEISTER.md` – Auftragsverarbeitung und Dienstleisterprüfung
- `DATENSCHUTZHINWEISE_ART13_ENTWURF.md` – Vorlage für Betroffeneninformation
- `INCIDENT_RESPONSE.md` – Prozess für Sicherheits-/Datenschutzverletzungen

## Freigabestatus

Technische Kontrollen sind umgesetzt, soweit sie im Projekt unmittelbar automatisierbar sind. Eine rechtliche Produktivfreigabe setzt insbesondere die Benennung der verantwortlichen Stelle, die Bestätigung der konkreten Rechtsgrundlagen, die Prüfung/Annahme der Auftragsverarbeitungsverträge, die Festlegung der endgültigen Aufbewahrungsfristen und die formale Freigabe der DSFA/TOM voraus.

Rechts- und Quellenbasis: DSGVO Art. 5, 9, 24, 25, 30, 32, 33, 34, 35 und 36; SGB V §§ 294 und 302; BGB § 630f, soweit auf die jeweilige Versorgung anwendbar; aktuelle DSK/BfDI-Hinweise; Supabase DPA, Version 1 vom 01.08.2026.
