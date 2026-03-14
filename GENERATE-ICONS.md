# Generera PWA App-Ikoner

Du behöver skapa app-ikoner för PWA-installationen. Här är instruktioner:

## Ikoner som behövs:

1. **icon-192.png** (192x192px) - Android & Chrome
2. **icon-512.png** (512x512px) - Android & Chrome (högupplöst)
3. **icon-apple-touch.png** (180x180px) - iOS Home Screen

## Rekommendationer:

- **Design**: Använd appen logotyp/symbol på mörk bakgrund (#0f0d15)
- **Format**: PNG med transparent eller mörk bakgrund
- **Stil**: Minimalistisk ikon som ser bra ut i liten storlek
- **Safe zone**: Låt 10% padding runt ikonen för iOS maskering

## Alternativ 1: Använd en icon generator (Snabbast)

1. Gå till: https://www.pwabuilder.com/imageGenerator
2. Ladda upp en 512x512px bild med din logotyp
3. Generera alla storlekar
4. Ladda ner och placera i `/public/` mappen

## Alternativ 2: Manuellt i Figma/Photoshop

1. Skapa en 512x512px canvas med #0f0d15 bakgrund
2. Placera logotyp/symbol i mitten (ca 400x400px)
3. Exportera som:
   - icon-512.png (512x512px)
   - icon-192.png (192x192px)
   - icon-apple-touch.png (180x180px)
4. Placera i `/public/` mappen

## Alternativ 3: Använd denna SVG som bas

Skapa en enkel hantel-ikon:

```svg
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0f0d15"/>
  <g transform="translate(256, 256)">
    <!-- Hantel-ikon -->
    <rect x="-120" y="-20" width="240" height="40" fill="#ff2d55" rx="4"/>
    <rect x="-150" y="-50" width="40" height="100" fill="#3b82f6" rx="8"/>
    <rect x="110" y="-50" width="40" height="100" fill="#3b82f6" rx="8"/>
    <circle cx="-150" cy="-60" r="12" fill="#2ed573"/>
    <circle cx="-150" cy="60" r="12" fill="#2ed573"/>
    <circle cx="150" cy="-60" r="12" fill="#2ed573"/>
    <circle cx="150" cy="60" r="12" fill="#2ed573"/>
  </g>
</svg>
```

Spara som `icon-base.svg` och konvertera till PNG med rätt storlekar.

## Temporär lösning (Nuvarande)

Just nu finns placeholder-referenser i manifestet. Appen kommer att fungera, men ikoner saknas.
För att testa PWA-funktionaliteten utan ikoner, kan du skapa enkla färgade fyrkanter:

```bash
# Skapa temporära enfärgade ikoner (kräver ImageMagick)
convert -size 192x192 xc:#0f0d15 public/icon-192.png
convert -size 512x512 xc:#0f0d15 public/icon-512.png
convert -size 180x180 xc:#0f0d15 public/icon-apple-touch.png
```

## Nästa steg

Efter att du har skapat ikonerna:
1. Placera dem i `/public/` mappen
2. Commit och pusha till GitHub
3. Vercel deployar automatiskt
4. Testa "Add to Home Screen" på din telefon!
