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



## Phase 2 – Reproduzierbare Abhängigkeiten und lokales Whisper-Modell

Umgesetzt am 07.10.2026:

- Ein versioniertes `package.json` enthält ausschließlich exakte Produktionsversionen.
- Ein committed `package-lock.json` (Lockfile v3) fixiert den vollständigen npm-Abhängigkeitsgraphen.
- Das Lockfile enthält für alle aufgelösten Pakete Integritätswerte; beim Audit wurden 107 aufgelöste Pakete mit Integritätswerten verifiziert.
- Der Pages-Build verwendet `npm ci` statt freier Neuauflösung über `npm install`.
- Ein `npm audit --omit=dev --audit-level=critical` ist Teil des Produktionsbuilds und blockiert Deployments bei kritischen npm-Sicherheitsbefunden.
- Das Whisper-Modell `onnx-community/whisper-tiny` ist auf den Upstream-Commit `ff4177021cc41f7db950912b73ea4fdf7d01d8e7` fixiert.
- Für den WASM-Pfad werden explizit die q8-Modelle `encoder_model_quantized.onnx` und `decoder_model_merged_quantized.onnx` verwendet.
- Die beiden ONNX-Dateien werden beim Build anhand fest hinterlegter SHA-256-Werte verifiziert.
- Modellkonfiguration, Tokenizer und ONNX-Dateien werden beim Build in das GitHub-Pages-Artefakt übernommen und zur Laufzeit ausschließlich same-origin geladen.
- Transformers.js hat `allowRemoteModels=false`; `localModelPath` zeigt auf den lokalen `models/`-Pfad.
- Hugging-Face-Domains wurden aus `connect-src` der CSP entfernt. Die Anwendung kann zur Laufzeit keine Whisper-Modellbestandteile mehr von Hugging Face nachladen.
- Der Build erzeugt Hashlisten für Vendor-Dateien und Modellbestand sowie einen SHA-256-Wert des Dependency-Lockfiles.

Damit besteht für OCR, PDF-Verarbeitung, Supabase-JavaScript-Laufzeit, Transformers-/ONNX-Runtime und Whisper-Sprachmodell kein ausführbarer bzw. modellbezogener CDN-/Hub-Laufzeitzugriff mehr. Externe Netzwerkverbindungen der Anwendung sind in der CSP im Wesentlichen auf das produktive Supabase-Projekt begrenzt.

## Verbleibende Härtung

- Inline-Styles schrittweise in eine statische CSS-Datei überführen und danach `style-src 'unsafe-inline'` entfernen.
- Automatisierte Browser-Regressionstests für MFA, Versorgungsspeicherung, OCR, PDF-Maßblätter und Spracheingabe ergänzen.
- Abhängigkeitsupdates kontrolliert über einen Review-/Updateprozess statt automatisch durchführen.
- Hosting mit frei konfigurierbaren HTTP-Sicherheitsheadern als spätere Option bewerten.
