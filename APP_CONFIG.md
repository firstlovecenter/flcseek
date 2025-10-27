# App Configuration

## Environment Variables

The app name and branding can be customized using environment variables in your `.env` file.

### Available Configuration Variables

#### `NEXT_PUBLIC_APP_NAME`
- **Default**: `FLC Sheep Seeking`
- **Description**: The full name of your application
- **Used in**: Page titles, browser tabs, app headers, PWA manifest
- **Example**: `NEXT_PUBLIC_APP_NAME=My Church Tracker`

#### `NEXT_PUBLIC_APP_SHORT_NAME`
- **Default**: `FLC`
- **Description**: Short abbreviation for your app (used in icons and compact displays)
- **Used in**: App icons, mobile displays
- **Example**: `NEXT_PUBLIC_APP_SHORT_NAME=MCT`

#### `NEXT_PUBLIC_APP_DESCRIPTION`
- **Default**: `Church milestone tracking system`
- **Description**: Brief description of your application
- **Used in**: Login page subtitle, meta descriptions
- **Example**: `NEXT_PUBLIC_APP_DESCRIPTION=Member progress tracking`

### How to Configure

1. Open your `.env` file (or create one from `.env.example`)
2. Add or update the configuration variables:

```env
NEXT_PUBLIC_APP_NAME=Your Church Name Tracker
NEXT_PUBLIC_APP_SHORT_NAME=YCN
NEXT_PUBLIC_APP_DESCRIPTION=Tracking member spiritual growth
```

3. Restart your development server for changes to take effect:
```bash
npm run dev
```

### Notes

- All these variables are prefixed with `NEXT_PUBLIC_` which means they are available in the browser
- Changes to these variables require a rebuild for production deployments
- The PWA manifest (`public/manifest.json`) should also be updated manually if you want to change the installed app name
- App icons in the `public/` folder display the short name and may need regeneration for custom branding

### Where These Values Appear

- **Browser tab title**: Uses `NEXT_PUBLIC_APP_NAME`
- **Login page**: Uses both `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_DESCRIPTION`
- **Navigation header**: Uses `NEXT_PUBLIC_APP_NAME`
- **Mobile app install prompt**: Uses `NEXT_PUBLIC_APP_NAME`
- **PWA installed app**: Title from environment variable

### Customization for Different Deployments

You can use different values for different environments:

**Development (.env.local)**
```env
NEXT_PUBLIC_APP_NAME=FLC Sheep Seeking [DEV]
```

**Production (.env.production)**
```env
NEXT_PUBLIC_APP_NAME=FLC Sheep Seeking
```

**Staging (.env.staging)**
```env
NEXT_PUBLIC_APP_NAME=FLC Sheep Seeking [STAGING]
```
