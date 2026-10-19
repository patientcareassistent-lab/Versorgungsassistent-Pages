# Reparaturtool PG24 – Version 13

Die vollständige HTML-Datei liegt unter `index.html`. Sie wird von GitHub Pages über `tools/reparatur-uex/index.html` mit ausgeliefert.

**Zugang:** ausschließlich innerhalb eines authentifizierten Reparaturvorgangs der Produktgruppe 24. Der eingebettete iFrame ist sandboxed ohne `allow-same-origin` und besitzt keine eigene Supabase-Verbindung. Die Web-App übergibt freigegebene Stammdaten, SIC-Hilfsmittel-ID und Rezeptangaben über eine tokengebundene Schnittstelle. Die PDF-Ansicht druckt die Originalseiten und ggf. die Fotobeilage lokal.

Vor Produktivfreigabe ist PR #53 vollständig zu testen. Für Bestandsfälle bleiben die bisherigen Reparaturangaben im übergeordneten Assistenten schreibgeschützt einsehbar. Produktivpatientendaten nicht für Tests verwenden.
