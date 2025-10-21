# Clear Login Cache Instructions

The `/stream-leader` redirect is likely caused by cached data in your browser.

## Steps to Fix:

### Option 1: Clear Browser Cache (Recommended)
1. Open Developer Tools (F12)
2. Go to **Application** tab
3. Click **Clear site data**
4. Or manually delete:
   - **Local Storage** → `token` and `user`
   - **Session Storage** → Clear all
5. Refresh the page (Ctrl + F5)

### Option 2: Manual JavaScript Clear
Open the browser console (F12 → Console) and run:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Option 3: Incognito/Private Window
1. Open an incognito/private browser window
2. Go to `http://localhost:3000`
3. Login with fresh session

## Test Login Credentials

After clearing cache, try logging in with:

```
Username: january_admin
Password: JanuaryAdmin2025!
```

You should be redirected to `/sheep-seeker` (not `/stream-leader`).

## What Changed

The codebase now correctly routes:
- **Admin** → `/sheep-seeker` (full edit access)
- **Leader** → `/sheep-seeker` (view-only access)  
- **Lead Pastor** → `/sheep-seeker` (view all groups)
- **Super Admin** → `/super-admin`

The `/stream-leader` route no longer exists and is not referenced anywhere in the code.
