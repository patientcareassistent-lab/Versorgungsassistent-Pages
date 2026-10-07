# Security Hardening

Stand: 07.10.2026

## Phase 1 – Runtime/Supply-Chain-Härtung

Umgesetzt:

- Der große Inline-Modulcode wurde aus `index.html` nach `app.js` ausgelagert.
- Eine Content-Security-Policy (CSP) ist direkt im HTML aktiviert.
- Ausführbarer JavaScript-Code darf nur noch aus der eigenen GitHub-Pages-Origin geladen werden.
- WebAssembly bleibt über `'wasm-unsafe-eval'` für OCR und lokale KI-Ausführung zulässig.
- Externe Script-CDNs (`esm.sh`, jsDelivr usw.) wurden aus dem Anwendungscode entfernt.
- Supabase JS 2.57.4 wird beim Deployment in den statischen Site-Artefakt übernommen und anschließend same-origin ausgeliefert.
- Tesseract.js 5.1.1, Tesseract Core 5.1.1 und das deutsche Sprachmodell werden beim Deployment same-origin bereitgestellt.
- PDF.js 4.10.38 wird same-origin bereitgestellt; beide bisherigen PDF.js-Ladewege nutzen nun dieselbe lokale Version.
- Transformers.js 4.3.0 und die ONNX-WASM-Laufzeit werden same-origin bereitgestellt.
- Der Tesseract-Worker, Core/WASM und das Sprachmodell werden ausdrücklich auf lokale Pfade gesetzt.
- Der ONNX-WASM-Pfad für Transformers.js wird ausdrücklich auf die lokale Site gesetzt.
- Referrer Policy ist auf `no-referrer` gesetzt.
- `object-src` ist deaktiviert; `base-uri` und `form-action` sind auf die eigene Origin beschränkt.
- Ein Deployment-Gate verhindert neue Remote-`import()`-, Remote-ESM-`from`- oder Remote-`<script src>`-Abhängigkeiten sowie neue Inline-Scriptblöcke.
- Der bereits vorhandene Production-Safety-Gate blockiert lokale Entwicklungs-Pfade und Secret-/Service-Role-Marker.
- Für die beim Build erzeugten Vendor-Dateien wird eine SHA-256-Liste in `vendor/SHA256SUMS` erzeugt.

## Weiterhin bewusst erlaubt

Die lokale Spracherkennung lädt das Whisper-Modell derzeit bei Bedarf von Hugging Face. Die ausführbare Transformers.js-/ONNX-Laufzeit ist bereits same-origin; die CSP erlaubt für Modelldateien Verbindungen zu Hugging-Face-/HF-Domains.

Supabase API- und WebSocket-Verbindungen bleiben ausschließlich zum produktiven Projekt `pypljdyqjpdkismbwuag.supabase.co` erlaubt.

## Nächste Härtungsstufen

1. Reproduzierbare Vendor-Builds mit committed Lockfile und festgehaltenen Integritätswerten statt nur exakt gepinnter Top-Level-Pakete.
2. Whisper-Modell vollständig same-origin bereitstellen oder die Spracheingabe bis dahin als optionales Feature mit klarer Netzabhängigkeit kennzeichnen.
3. Inline-Styles schrittweise entfernen, um `style-src 'unsafe-inline'` aus der CSP entfernen zu können.
4. Hosting-Option mit kontrollierbaren HTTP-Security-Headers prüfen. GitHub Pages erlaubt keine frei konfigurierbaren Response-Header; die aktuelle CSP wird deshalb als HTML-Meta-Policy ausgeliefert.
5. Browserbasierte Regressionstests für Login, MFA, OCR, PDF-Maßblatt, Spracheingabe und Supabase-Autosave automatisieren.

