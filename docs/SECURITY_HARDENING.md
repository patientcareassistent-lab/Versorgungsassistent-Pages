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

## Laufzeit-Netzwerkgrenzen

Supabase API- und WebSocket-Verbindungen bleiben auf das produktive Projekt `pypljdyqjpdkismbwuag.supabase.co` begrenzt. Das Whisper-Modell wird seit Phase 2 beim Build fest gepinnt, geprüft und same-origin ausgeliefert; Hugging-Face-Domains sind nicht mehr in der Laufzeit-CSP freigegeben.


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

## Phase 3 – Strikte Style-CSP ohne `unsafe-inline`

Umgesetzt am 07.10.2026:

- Der vollständige statische CSS-Bestand wurde aus `index.html` in `styles.css` ausgelagert.
- Alle verbliebenen statischen `style="..."`-Attribute wurden durch CSS-Klassen ersetzt.
- Alle JavaScript-Zuweisungen über `.style.*` wurden entfernt.
- Dynamische PDF-/Maßblatt-Geometrien und Fortschrittsbreiten werden über validierte CSS-Regeln in das bereits same-origin geladene Stylesheet eingefügt. Erlaubt sind dabei ausschließlich `left`, `top`, `width`, `height` und `font-size` mit numerischen `px`-/`%`-Werten.
- Sichtbarkeit wird über bestehende CSS-Klassen statt Inline-Styles gesteuert.
- Die CSP verwendet nun `style-src 'self'; style-src-elem 'self'; style-src-attr 'none'`. `'unsafe-inline'` ist für Styles vollständig entfernt.
- Der Deployment-Gate blockiert künftig Inline-`<style>`-Blöcke, `style=`-Attribute, JavaScript-`.style`-Mutationen, Remote-CSS-Abhängigkeiten und eine Lockerung der strikten Style-CSP.
- Zusätzlich prüft `node --check app.js` die JavaScript-Syntax vor jedem Deployment.

Der Produktions-Deploy mit der strikten Style-CSP und sämtlichen bestehenden Supply-Chain-Gates ist erfolgreich durchgelaufen.

## Verbleibende Härtung

- Automatisierte Browser-Regressionstests für MFA, Versorgungsspeicherung, OCR, PDF-Maßblätter und Spracheingabe ergänzen.
- Abhängigkeitsupdates kontrolliert über einen Review-/Updateprozess statt automatisch durchführen.
- Hosting mit frei konfigurierbaren HTTP-Sicherheitsheadern als spätere Option bewerten. GitHub Pages liefert die CSP derzeit als HTML-Meta-Policy aus.


## Phase 4 – Browser-Regression und lokale Spracheingabe mit whisper.cpp

Umgesetzt am 07.10.2026:

- Die vorherige Transformers.js-/ONNX-Sprachpipeline wurde vollständig durch `whisper.cpp` WebAssembly ersetzt.
- `whisper.cpp` ist auf Upstream-Commit `d1be6fde11ac6e0407606b4e42fe72d34add8037` (1.9.5-dev) fixiert und wird im CI-/Pages-Build aus dem gepinnten Quellstand kompiliert.
- Verwendet wird das multilinguale quantisierte Modell `ggml-tiny-q5_1.bin`; dessen SHA-256 ist auf `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7` fixiert.
- Die Inferenz läuft absichtlich single-threaded (`n_threads = 1`) in einem dedizierten Web Worker. Dadurch bleibt die Benutzeroberfläche responsiv, ohne SharedArrayBuffer, Pthreads oder COOP/COEP-Sonderheader vorauszusetzen.
- Modell, WASM-Laufzeit und Worker werden ausschließlich same-origin ausgeliefert. Audio verlässt den Browser nicht.
- Die frühere `@huggingface/transformers`-Abhängigkeit wurde aus `package.json` und dem Lockfile entfernt. Der npm-Lockgraph wurde dadurch von 112 auf 45 Einträge reduziert.
- Der vollständige Phase-4-Browserlauf umfasst Login-/MFA-Gating, Sicherheitszugriffe, Autosave/Wiederöffnung, OCR, PDF.js/AOK-Formular, whisper.cpp/WASM und Upload-Grenzen. Der geprüfte Stand erreichte 12 bestandene Tests; der optionale echte MFA-Test wurde mangels dedizierter CI-Testaccount-Secrets übersprungen.
- Der produktive Pages-Workflow kompiliert whisper.cpp, prüft Modell- und Runtime-Hashes, installiert Chromium und führt die Browser-Regressionen vor dem eigentlichen Pages-Deploy aus. Ein fehlschlagender Regressionstest verhindert damit den Produktionsdeploy.

Hinweis zur Historie: Die in Phase 1/2 dokumentierte Transformers.js-/ONNX-Implementierung war ein Zwischenschritt und ist für die Spracheingabe durch diese Phase ersetzt. Die dort eingeführten Prinzipien – same-origin Laufzeit, feste Versionen, Hashprüfung und keine Runtime-CDN-Zugriffe – bleiben bestehen.
