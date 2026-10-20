# Port Side TV

16:9-Animationsprogramm für die Hotelbildschirme im Port Side Resort Hotel.

Die Anzeige enthält das aktuelle Tagesprogramm, die Show des Abends, die laufende Programmwoche und das Wetter in Side. Alle Oberflächentexte sind Deutsch. Die beiden Programmwochen wechseln ab dem 13. Juli 2026 automatisch. Sonntags finden keine Tagesaktivitäten und keine Mini-Disco statt; die Abendshow bleibt sichtbar.

Die Datumsauswahl folgt `Europe/Istanbul`. Um 22:30 Uhr wird die Seite einmal neu geladen. Um Mitternacht wechselt die Anzeige ohne vollständiges Neuladen auf den neuen Kalendertag. Die Wetterdaten werden alle 30 Minuten von Open-Meteo aktualisiert.

## Lokal öffnen

```sh
python3 -m http.server 8765 --directory dist
```

Anschließend `http://localhost:8765` öffnen. Ein Doppelklick oder die Taste `F` aktiviert, soweit vom Browser unterstützt, den Vollbildmodus. Für die Vorschau eines bestimmten Tages kann `?date=2026-10-20` angehängt werden.

## Programm bearbeiten

Die Daten stehen in `dist/program.json`, die Originalplakate in `dist/assets/`. Zeitlich begrenzte Veranstaltungen erhalten ein genaues Datum. Programmgrundlage ist das bestehende [Port-Side-QR-Programm](https://github.com/Portsideresort/Port-Side-Resort-).

## Prüfen und veröffentlichen

```sh
node --test tests/program.test.mjs
```

Ein Push auf `main` veröffentlicht ausschließlich `dist/` über GitHub Pages.

Wetterquelle: [Open-Meteo](https://open-meteo.com/).
