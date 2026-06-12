# Dagboek

Persoonlijke journal- en dagtracker-app (PWA) voor Android. Volledig offline, alle data staat lokaal op je telefoon.

## Functies

- **Vandaag**: ochtend- en avondcijfer (1–10), 3 dankbaarheidsvelden, vrij journal, sportminuten (presets of vrij invullen) — alles met autosave
- **Pijn** (losse feature): dagelijkse pijnscore 0–10 met notitie en overzicht van de laatste 14 dagen
- **Geschiedenis**: terugbladeren en eerdere dagen bewerken
- **Inzichten**: lijngrafieken (30/90 dagen) van dagcijfers, pijnscore en sportminuten + JSON export/import voor back-ups

## Lokaal draaien (testen op de pc)

```
npx serve dagboek-app
```

## Op je telefoon zetten

1. Host deze map ergens met HTTPS (gratis opties: GitHub Pages, Netlify Drop of Cloudflare Pages — gewoon de map uploaden, er is geen build-step).
2. Open de URL op je telefoon in Chrome.
3. Menu (⋮) → **"Toevoegen aan startscherm"** / **"App installeren"**.
4. De app werkt daarna volledig offline; data staat alleen op je telefoon.

## Back-ups

Tabblad **Inzichten → Back-up → Exporteren** downloadt een JSON-bestand met al je data. Bewaar dit af en toe ergens veilig (bijv. Google Drive). Met **Importeren** zet je het terug, ook op een nieuwe telefoon.

> Let op: als je de sitegegevens van de app wist in Chrome, ben je je data kwijt. Maak dus regelmatig een export.
