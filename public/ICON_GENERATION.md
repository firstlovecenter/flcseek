# PWA Icon Generation Guide

## Quick Start - Use Online Tool (Recommended)

1. **Visit**: https://realfavicongenerator.net/ or https://www.pwa-icon-generator.com/

2. **Upload** your logo/icon (preferably 512x512px or larger)

3. **Generate** all required sizes automatically

4. **Download** the zip file

5. **Extract** all icons to the `public` folder

## Required Icon Sizes

For the best PWA experience, you need these icon sizes:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`
- `apple-touch-icon.png` (180x180px)
- `favicon.ico`

## Manual Generation (Using ImageMagick)

If you have ImageMagick installed:

```powershell
# From the public folder
$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)
foreach ($size in $sizes) {
    magick convert icon.svg -resize ${size}x${size} icon-${size}x${size}.png
}

# Generate apple-touch-icon
magick convert icon.svg -resize 180x180 apple-touch-icon.png

# Generate favicon
magick convert icon.svg -resize 32x32 favicon.ico
```

## Using the SVG Template

I've created `icon.svg` as a placeholder. To customize:

1. Open `public/icon.svg` in a text editor or design tool
2. Modify colors, shapes, and text to match your brand
3. Use the online tools above to generate all sizes

## Design Tips

- **Keep it simple**: Icons should be recognizable at small sizes
- **High contrast**: Ensure good visibility on various backgrounds
- **Square format**: Design for 1:1 aspect ratio
- **Safe zone**: Keep important elements within 80% of the canvas
- **Test**: Check how it looks at different sizes

## Current Placeholder

The current `icon.svg` features:
- Blue gradient background (#003366 to #0066cc)
- White sheep silhouette
- "FLC" text

Replace this with your actual church logo!
