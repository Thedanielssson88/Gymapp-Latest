# Skapa PWA-ikoner från SVG

En SVG-fil `public/icon.svg` har skapats med en hantel-ikon. Nu behöver du konvertera den till PNG-format i olika storlekar.

## Snabbaste sättet: Online-konverterare

1. **Gå till**: https://convertio.co/sv/svg-png/ eller https://cloudconvert.com/svg-to-png
2. **Ladda upp** `public/icon.svg`
3. **Konvertera till PNG** med följande storlekar:
   - **512x512px** → Spara som `icon-512.png`
   - **192x192px** → Spara som `icon-192.png`
   - **180x180px** → Spara som `icon-apple-touch.png`
4. **Placera alla** i `/public/` mappen

## Alternativ: Använd Figma/Canva (Rekommenderat)

1. **Öppna** `icon.svg` i Figma eller Canva
2. **Exportera** som PNG i olika storlekar:
   - 512x512px → `icon-512.png`
   - 192x192px → `icon-192.png`
   - 180x180px → `icon-apple-touch.png`
3. **Placera** i `/public/` mappen

## Alternativ: Kommandorad (Om du har ImageMagick)

```bash
cd /workspace/group/Byggen/Gymapp/public

# Konvertera SVG till PNG i olika storlekar
convert -background none icon.svg -resize 512x512 icon-512.png
convert -background none icon.svg -resize 192x192 icon-192.png
convert -background none icon.svg -resize 180x180 icon-apple-touch.png
```

## Vercel Deployment

Efter att ikonerna är skapade:

```bash
git add public/*.png
git commit -m "Lagt till PWA-ikoner"
git push origin main
```

Vercel deployar automatiskt!

## Testa PWA

### På Android (Chrome):
1. Öppna appen i Chrome
2. Tryck på ⋮ (meny)
3. Välj "Lägg till på startskärmen" / "Install app"
4. Appen installeras som en native app!

### På iPhone (Safari):
1. Öppna appen i Safari
2. Tryck på dela-knappen
3. Scrolla och välj "Lägg till på hemskärmen"
4. Appen läggs till som en native app!

## Vad som händer efter installation:

✅ Appen öppnas i fullskärm (ingen webbläsare-UI)
✅ Egen ikon på hemskärmen
✅ Offline-stöd via Service Worker
✅ Snabbare laddning (cachade resurser)
✅ Push-notifikationer möjliga (framtida feature)

## Troubleshooting

**"Add to Home Screen" visas inte:**
- Kontrollera att manifest.json laddas (kolla DevTools Console)
- Kontrollera att HTTPS används (Vercel har detta automatiskt)
- Service Worker måste vara registrerad

**Ikoner visas inte:**
- Kontrollera att PNG-filerna finns i `/public/`
- Rensa cache och testa igen
- Kolla filnamnen matchar manifest.json

## Nästa steg

Efter ikoner är skapade, commit och pusha:

```bash
cd /workspace/group/Byggen/Gymapp
git add public/*.png
git commit -m "PWA ikoner tillagda"
git push origin main
```

Klart! 🎉
