/**
 * Push Notifications Helper
 * Handles browser push notification registration and sending
 */

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 
    'Notification' in window && 
    'serviceWorker' in navigator;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported()) return 'unsupported';
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('[PUSH] Failed to request permission:', error);
    return 'denied';
  }
}

/**
 * Show a browser notification
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions
): Promise<boolean> {
  if (!isPushSupported()) return false;
  
  if (Notification.permission !== 'granted') {
    console.warn('[PUSH] Notifications not permitted');
    return false;
  }

  try {
    // Try to use service worker for better control
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/icon.svg',
      badge: '/icon.svg',
      requireInteraction: false,
      ...options,
    });
    return true;
  } catch (error) {
    // Fallback to regular notification
    try {
      new Notification(title, {
        icon: '/icon.svg',
        ...options,
      });
      return true;
    } catch (fallbackError) {
      console.error('[PUSH] Failed to show notification:', fallbackError);
      return false;
    }
  }
}

/**
 * Subscribe to push notifications (for future use with push server)
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return subscription;
    }

    // For now, we don't have a VAPID key, so just return null
    // In production, you'd subscribe with your VAPID public key:
    // subscription = await registration.pushManager.subscribe({
    //   userVisibleOnly: true,
    //   applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    // });
    
    return null;
  } catch (error) {
    console.error('[PUSH] Failed to subscribe:', error);
    return null;
  }
}

/**
 * Check and show notification for new items
 */
export async function checkAndNotify(
  notifications: Array<{ id: string; title: string; message: string; type: string }>
): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  
  // Get last checked notification IDs from localStorage
  const lastCheckedStr = localStorage.getItem('flcseek_last_notifications');
  const lastChecked = lastCheckedStr ? JSON.parse(lastCheckedStr) : [];
  
  // Find new notifications
  const newNotifications = notifications.filter(n => !lastChecked.includes(n.id));
  
  if (newNotifications.length > 0) {
    // Show notification for the most recent one
    const newest = newNotifications[0];
    await showNotification(newest.title, {
      body: newest.message,
      tag: `flcseek-${newest.id}`,
      data: { notificationId: newest.id },
    });
    
    // Update last checked
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('flcseek_last_notifications', JSON.stringify(allIds));
  }
}
