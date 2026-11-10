# Stundenplan Live auf Render

Dieses Projekt stellt die grafische Stundenplan-App und den WebUntis-Proxy unter derselben Render-Adresse bereit. Der Browser ruft `/api/webuntis/week` auf derselben Origin auf; dadurch braucht die App keine Verbindung von der Langdock-Vorschau zu einer fremden Domain.

## Render-Einstellungen

- Service type: Web Service
- Runtime: Node
- Root Directory: leer lassen (oder der Ordner, in dem diese Dateien liegen)
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Node.js: Version 18 oder neuer

Nicht als Static Site deployen: Der Node-Prozess bedient sowohl die API als auch die gebaute Oberfläche.

## Nach dem Deploy testen

- `https://DEINE-APP.onrender.com/` → grafische App
- `https://DEINE-APP.onrender.com/api/health` → JSON mit `"ok":true`
- `https://DEINE-APP.onrender.com/api/webuntis/week?school=hh5842&elementType=1&elementId=1669&date=2026-11-16` → WebUntis-JSON

Die App lädt automatisch die aktuelle und drei Folgewochen, aktualisiert sie regelmäßig und lädt weitere Wochen beim Blättern. Sie zeigt den importierten Stundenplan, bis der Live-Abruf erfolgreich ist.

Es werden keine WebUntis-Zugangsdaten benötigt. Der Upstream-Abruf ist auf den öffentlichen Stundenplan der Schule hh5842, Element 1669 beschränkt.
