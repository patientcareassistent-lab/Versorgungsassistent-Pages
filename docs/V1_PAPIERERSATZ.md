# Versorgungsassistent V1 – Papierersatz

Stand: 07.10.2026. Arbeitsplan und erste Umsetzung, keine Produktivfreigabe.

## Ziel und Abgrenzung

V1 ersetzt die im freigegebenen Pilotprozess verwendeten Papierunterlagen durch einen durchgängigen digitalen Vorgang. Erfolg bedeutet: Angaben einmal erfassen, nach Unterbrechung wieder öffnen, erforderliche Formulare und Unterschriften vollständig ausgeben und zuverlässig ablegen. Manuelle Bearbeitung ist ein vollwertiger Weg.

OCR, Spracherkennung, automatische Vertragsentscheidung, eKV/Egeko und weitere Schnittstellen sind nachgelagert. Ihr Fehlen darf den manuell bedienbaren Pilotablauf nicht verhindern. Die bestehende Archivierung darf erst nach nachgewiesenem Ende-zu-Ende-Erfolg als erledigt gelten.

## Geprüfte Ausgangslage

Quellstand: `patientcareassistent-lab/Versorgungsassistent-Pages`, Commit `98d594ac386c21a74b24166869187d093a664d80`.

- Vorhanden im Code: elf kontextabhängige Arbeitsschritte, Neuversorgung/Reparatur, Stammdaten, Rezepttext, Profile, Maße, Planung, Genehmigung, Verlauf, Abgabe und Abschluss.
- Vorhanden: Signaturfelder, teamweite Übersicht, automatische Speicherung, Wiedereinstieg und Druckfunktion. Konkrete Formularabdeckung und Ausgabequalität müssen je Pilotpfad abgenommen werden.
- Fremde Vorgänge werden derzeit nur lesend geöffnet. Vertretung und Übergabe an andere Bearbeiter sind deshalb ein eigener V1-Entscheidungspunkt.
- Vertragswissen wird bereits mit Vertrag, Version und Quelle angezeigt; erneut zu prüfende Einträge werden gesondert behandelt.
- Die Projektdatei `PRODUCTION_READINESS.md` dokumentiert MFA/RLS-, Revisions- und Restore-Prüfungen. Diese Sitzung hat diese Live-Prüfungen nicht wiederholt.
- Dieselbe Datei nennt noch offene organisatorische Freigaben und keinen erfolgreichen externen Archivlauf zum dortigen Prüfzeitpunkt. Der vorhandene technische Stand allein belegt keinen freigegebenen Papierersatz.

## V1-Mindestumfang und Abnahme

| Bestandteil | V1-Ergebnis | Konkreter Nachweis |
|---|---|---|
| Formularumfang | Jedes tatsächlich verwendete Papier des Pilotpfads hat ein digitales Gegenstück | Papierinventar, Feldvergleich und verantwortliche Fachfreigabe |
| Erfassung | Alle Pflichtangaben manuell erfassbar | Fall ohne OCR und Sprache vollständig bearbeiten |
| Speichern | Bestätigter Speicherstand, sichtbare Fehler und Wiederaufnahme | Speichern, Browser neu laden, Daten einschließlich Signaturen vergleichen |
| Unterlagen | Rezept/Anlagen dauerhaft dem Fall zugeordnet, falls im Pilot erforderlich | Nach Anmeldung auf anderem Gerät wieder öffnen; ein Dateiname oder Erfassungsflag reicht nicht |
| Unterschriften | Richtiger Unterzeichner, Erklärung und Dokumentstand erkennbar | Fachprüfung der Signaturfelder und vollständiger PDF-Ausgabe; Änderung nach Unterschrift gesondert behandeln |
| Ausgabe | Alle relevanten Seiten, Werte und Signaturen lesbar | PDF-Seitenvergleich mit Papieroriginal auf den Pilotgeräten |
| Ablage | Fall später eindeutig auffindbar und wiederherstellbar | Archivieren/vereinbarten Ablageweg durchführen, wieder abrufen und Wiederherstellung demonstrieren |
| Team | Zuständigkeit und Vertretungsweg funktionieren | Fall an Vertretung übergeben; derzeitige Nur-Lesen-Grenze beachten |
| Vertragswissen | Verwendete Vorgaben haben Quelle, Geltungsbereich und Version | Stichprobe pro freigegebenem Kostenträger und Versorgungspfad |
| Betrieb | Verantwortlicher, Support, Ausfallweg und notwendige Freigaben stehen fest | Dokumentierte Entscheidung vor Einsatz mit echten Fällen |

## Umsetzung in vier Etappen

Zeitangaben sind Planungsannahmen ab Verfügbarkeit der Originalunterlagen und Verantwortlichen, keine zugesagten Termine.

| Etappe | Zeitansatz | Arbeit | Verantwortliche Rolle | Ergebnis |
|---|---|---|---|---|
| 1. Umfang festlegen | 1–2 Arbeitstage | Einen häufigen, überschaubaren Versorgungspfad wählen; alle Papierunterlagen aufnehmen; Feldabgleich; Ablage und Vertretung festlegen | Fachverantwortlicher + Projektleitung | Verbindlicher V1-Umfang mit Papier-zu-Digital-Matrix |
| 2. Lücken schließen | 3–5 Arbeitstage, nach Inventur neu schätzen | Fehlende Felder/Anlagen/Signaturen, verlässliche Ausgabe und Ablage; manuelle Wege durchgängig testen | Entwicklung + Fachbereich | Technisch prüfbarer Pilotstand |
| 3. Pilot abnehmen | 3–5 Arbeitstage | Zwei bis drei benannte Anwender; ca. zehn repräsentative Testfälle, danach freigegebene echte Pilotfälle; Rückmeldungen täglich sammeln | Pilotteam + IT + Fachverantwortlicher | Abnahmeprotokoll und behobene kritische Fehler |
| 4. Regelbetrieb | Nach erfüllter Abnahme | Kurzschulung, benannter Support, kontrollierte Ausweitung je freigegebenem Pfad | Projektleitung + Teamleitung | Papier im freigegebenen Umfang abgelöst |

## Erste Schritte

1. Pilotprozess und Fachverantwortlichen benennen. Vorschlag: ein häufiger, fachlich überschaubarer Pfad mit vorhandenen Originalformularen; keine pauschale Freigabe aller Produktgruppen.
2. Originalpapier für diesen Pfad sammeln: Erhebung, Maße, Beratung, Empfang/Einweisung, ggf. Reparatur, Anlagen und Unterschriften. Auch tatsächlich genutzte Rückseiten und Zusatzblätter berücksichtigen.
3. Jedes Papierfeld einem vorhandenen digitalen Feld zuordnen. Fehlendes als V1-Blocker erfassen. Die vollständige aktuelle Papiermappe war dieser Sitzung nicht beigefügt; eine vollständige Abdeckung ist deshalb noch nicht belegt.
4. Ablageziel und Verantwortlichkeit verbindlich festlegen. Ein Browserdruck oder Download ist keine bestätigte Archivierung. Vorhandenen externen Archivpfad mit Testfall bis zum Wiederabruf prüfen.
5. Einen Fall komplett manuell bearbeiten und nach Neuanmeldung auf einem zweiten Gerät kontrollieren. Insbesondere Rezeptdatei, Anhänge und Unterschriften prüfen.
6. Offene Punkte priorisieren: Verlust von Daten, fehlende Pflichtunterlagen, unvollständige Ausgabe und unklare Bearbeitungsrechte zuerst; Automation danach.

## Nutzung des Vertragsmanager-Wissens

Die Erlaubnis zur Nutzung ist gegeben. Wissen wird als fachliche Unterstützung übernommen: Kostenträger, PG/HiMi, Versorgungssituation, erforderliches Formular, Pflichtangaben und Belegstelle. Die vorhandene Wissensansicht wird weiterverwendet.

Pro übernommener Regel festhalten: Quellvertrag, Version/Gültigkeit, Fundstelle, Geltungsbereich, fachlicher Prüfer und Freigabestatus. Bei unklarer oder überholter Grundlage erfolgt eine manuelle Vertragsklärung; daraus darf keine positive Entscheidung abgeleitet werden. Diese erste Umsetzung importiert keine neuen Vertragsregeln und behauptet keine Vollständigkeit der Wissensbasis.

## Erste Umsetzung in diesem Änderungsstand

- Aufklappbare Dokumentationsprüfung im Vorgang: zeigt je relevantem, unvollständigem Arbeitsschritt die konkret fehlenden Angaben aus der bestehenden Validierung.
- Schaltfläche „Jetzt speichern“: nutzt die vorhandene Fallpersistenz und zeigt Erfolg oder Fehler an.
- Druck/PDF aus der Anwendung wartet bei eigenen Vorgängen auf die Speicherung. Bei Speicherfehler startet kein Druckdialog; erneuter Versuch ist möglich.
- Teamvorgänge im Nur-Lesen-Modus bleiben druckbar und können über die neue Schaltfläche nicht gespeichert werden.
- Kein Schemawechsel, kein neuer Patientenspeicher, keine Veränderung von Vertrags- oder Archivfreigaben.

Die Checkliste prüft ausschließlich die bereits hinterlegten Regeln. Sie entdeckt keine bislang fehlende Formularregel und ist keine Vertrags- oder Produktivfreigabe. Der direkte Browserdruck außerhalb der Anwendung bleibt technisch möglich. Die Änderung ersetzt keine Archivierung und löst noch keine mögliche Bearbeitungskollision zwischen mehreren Sitzungen desselben Benutzers.

## Pilotfälle und Freigabeentscheidung

Technische Prüfung dieses Änderungsstands: sieben isolierte Verhaltenstests der tatsächlichen App-Funktionen mit `node --test tests/paper-v1.test.cjs` und JavaScript-Syntaxprüfung. Drei Browser-Regressionstests sind ergänzt. Die Browserausführung ist in dieser Arbeitsumgebung durch eine fehlende Chromium-Installation und einen fehlgeschlagenen Browserdownload blockiert; sie muss vor Merge in der vorhandenen CI ausgeführt werden. Live-Datenbank, echte PDF-Ausgabe und externe Archivierung wurden hier nicht neu abgenommen.

Mindestens prüfen: unvollständiger Neuauftrag, vollständige Neuversorgung, Reparatur, fehlendes Rezept, unterschriebenes Formular, mehrere Anlagen, Speichern bei Netzfehler, Wiedereinstieg, fremder Teamvorgang und Abschluss mit Wiederabruf. Nur im jeweiligen Pfad anwendbare Varianten verlangen.

Freigabe erst, wenn sämtliche für den Pilot erforderlichen Papierfelder abgebildet sind, kein Datenverlust auftritt, PDF/Anlagen/Signaturen vollständig vorliegen, der Ablageweg nachgewiesen ist, Vertretung funktioniert und die in `PRODUCTION_READINESS.md` offenen Freigabepunkte für den gewählten Betrieb geklärt sind. Die zuständigen Personen werden von der Projektleitung benannt.

Erfolg im Pilot: alle Pflichtunterlagen auffindbar; keine vermeidbare doppelte Erfassung auf Papier; null kritische Datenverlust- oder Ausgabeprobleme. Bearbeitungsdauer und Rückfragen werden zunächst gemessen und erst danach als Verbesserungsziele festgelegt.
