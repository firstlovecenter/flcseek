# PWA & Mobile - Quick Reference

## 🚀 Quick Start

### Build & Test PWA

```powershell
# Build production version (enables PWA)
npm run build

# Start production server
npm start

# Visit: http://localhost:3000
```

### Install Instructions for Users

**📱 Android/Chrome:**
1. Open app in browser
2. Tap "Install" prompt OR
3. Menu (⋮) → "Add to Home Screen"

**📱 iPhone/iPad:**
1. Open in Safari
2. Share button → "Add to Home Screen"

**💻 Desktop:**
1. Click install icon in address bar
2. Or Menu → "Install FLC Sheep Seeking"

---

## 📂 Files Changed

| File | Changes |
|------|---------|
| `next.config.js` | Added PWA configuration |
| `public/manifest.json` | App metadata & icons |
| `app/layout.tsx` | PWA meta tags & viewport |
| `app/page.tsx` | Mobile responsive login |
| `app/super-admin/page.tsx` | Mobile responsive dashboard |
| `app/globals.css` | 200+ lines mobile utilities |

---

## 🎨 Icon Generation (TODO)

**Current Status:** Icon placeholders created

**Action Required:**
1. Visit: https://realfavicongenerator.net/
2. Upload your church logo (512x512px)
3. Download generated icons
4. Place in `public` folder

**Required Files:**
```
icon-72x72.png
icon-96x96.png
icon-128x128.png
icon-144x144.png
icon-152x152.png
icon-192x192.png
icon-384x384.png
icon-512x512.png
apple-touch-icon.png (180x180)
favicon.ico
```

See: `public/ICON_GENERATION.md`

---

## 📱 Mobile Features

### ✅ Implemented

- **Touch-friendly buttons** (44px minimum)
- **Responsive tables** (horizontal scroll)
- **Fluid typography** (scales with screen)
- **Safe area support** (notched devices)
- **No zoom on input** (iOS fix)
- **Adaptive layouts** (grid/flex)
- **Touch gestures** optimized
- **Fast tap response** (no delays)

### CSS Utilities Added

```css
.touch-target          /* 44x44px minimum */
.text-responsive-sm    /* Fluid text sizing */
.mobile-container      /* Responsive padding */
.hide-mobile          /* Hide on small screens */
.show-mobile          /* Show only on mobile */
.btn-touch            /* Touch-optimized button */
.grid-auto-fit        /* Responsive grid */
```

---

## 🧪 Testing Checklist

### Quick Test

```
✅ Build production version
✅ Install on phone
✅ Test offline mode
✅ Check all pages work
✅ Verify icon displays
```

### Detailed Test

```
✅ Chrome DevTools device mode
✅ Test on real Android device
✅ Test on real iPhone
✅ Install on desktop
✅ Check Lighthouse PWA score (90+)
✅ Verify service worker registered
✅ Test table horizontal scroll
✅ Check button touch targets
✅ Verify no horizontal overflow
✅ Test form inputs (no zoom)
```

### Browser DevTools

**Chrome:**
1. F12 → Application tab
2. Check Manifest, Service Workers, Cache

**Lighthouse:**
1. F12 → Lighthouse tab
2. Run PWA audit
3. Target: 90+ score

---

## 🔧 Configuration

### Theme Color

Change in 2 places:

**1. `public/manifest.json`:**
```json
"theme_color": "#003366"
```

**2. `app/layout.tsx`:**
```typescript
themeColor: '#003366'
```

### App Name

**`public/manifest.json`:**
```json
"name": "FLC Sheep Seeking - Church Progress Tracker",
"short_name": "FLC Sheep Seeking"
```

**`app/layout.tsx`:**
```typescript
title: 'FLC Sheep Seeking'
```

---

## 🐛 Common Issues

### "Add to Home Screen" not appearing
- ✅ Use HTTPS (or localhost)
- ✅ Generate app icons
- ✅ Build production version

### Service Worker not working
- ✅ Run `npm run build` (disabled in dev)
- ✅ Check browser console for errors
- ✅ Verify manifest is accessible

### Icons not showing
- ✅ Generate required icon sizes
- ✅ Place in `public` folder
- ✅ Clear cache and reinstall

### Mobile layout issues
- ✅ Test with DevTools device mode
- ✅ Check for overflow-x on containers
- ✅ Verify responsive utilities applied

---

## 📊 PWA Features

### Caching Strategy

| Type | Strategy | Lifetime |
|------|----------|----------|
| Images | Cache First | 24 hours |
| Fonts | Cache First | 365 days |
| JS/CSS | Stale While Revalidate | 24 hours |
| API | Network First | Excluded |

### Offline Support

When offline:
- ✅ Static pages load from cache
- ✅ Images/assets available
- ✅ API calls fail gracefully
- ❌ Real-time data unavailable

---

## 📝 Next Steps

1. **Generate Icons** → Use online tool
2. **Test PWA** → Install on devices
3. **Deploy** → Requires HTTPS
4. **Share** → Give install instructions

---

## 📚 Documentation

- **Full Guide:** `PWA_MOBILE_SETUP.md`
- **Icon Guide:** `public/ICON_GENERATION.md`
- **Next-PWA:** https://github.com/shadowwalker/next-pwa

---

## ✅ Status

- ✅ PWA Configured
- ✅ Mobile Responsive
- ✅ Service Worker Ready
- ✅ Manifest Created
- ⏳ Icons Pending (use online generator)

**Ready for production after icon generation!**
