// App configuration constants
// These are read from environment variables at build time

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'FLC Sheep Seeking';
export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME || 'FLC';
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Church milestone tracking system';

// Helper function to get app config
export function getAppConfig() {
  return {
    name: APP_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
  };
}
