'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge, Dropdown, Typography, Spin, Empty, Button, List, Avatar, message, Tooltip } from 'antd';
import { 
  BellOutlined, 
  GiftOutlined, 
  UserOutlined, 
  WarningOutlined,
  CheckCircleOutlined,
  NotificationOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeStyles } from '@/lib/theme-utils';
import { 
  isPushSupported, 
  getNotificationPermission, 
  requestNotificationPermission,
  checkAndNotify 
} from '@/lib/push-notifications';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relativeTime plugin for .fromNow()
dayjs.extend(relativeTime);

const { Text, Title } = Typography;

interface Notification {
  id: string;
  type: 'birthday' | 'inactive' | 'info';
  title: string;
  message: string;
  person_id?: string;
  person_name?: string;
  created_at: string;
  read?: boolean;
}

/**
 * Notification Bell Component
 * Shows a bell icon with badge count and dropdown with notifications
 */
export default function NotificationBell() {
  const { token, user } = useAuth();
  const themeStyles = useThemeStyles();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>('default');

  // Check push notification permission on mount
  useEffect(() => {
    if (isPushSupported()) {
      setPushPermission(getNotificationPermission());
    }
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (visible && token) {
      fetchNotifications();
    }
  }, [visible, token]);

  // Initial fetch on mount
  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        
        // Check for push notifications
        if (pushPermission === 'granted') {
          checkAndNotify(data.notifications || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (!token || notifications.length === 0) return;
    
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) {
      message.info('All notifications are already read');
      return;
    }

    try {
      setMarkingAll(true);
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        message.success(`Marked ${unreadIds.length} notifications as read`);
      } else {
        message.error('Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      message.error('Failed to mark notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  // Enable push notifications
  const handleEnablePush = async () => {
    const result = await requestNotificationPermission();
    setPushPermission(result);
    
    if (result === 'granted') {
      message.success('Push notifications enabled!');
    } else if (result === 'denied') {
      message.warning('Push notifications were denied. You can enable them in browser settings.');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'birthday':
        return <GiftOutlined style={{ color: '#ff69b4' }} />;
      case 'inactive':
        return <WarningOutlined style={{ color: themeStyles.warning }} />;
      default:
        return <BellOutlined style={{ color: themeStyles.primary }} />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const dropdownContent = (
    <div
      style={{
        width: 360,
        maxHeight: 450,
        overflow: 'hidden',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          Notifications
        </Title>
        {unreadCount > 0 && (
          <Badge count={unreadCount} style={{ backgroundColor: themeStyles.primary }} />
        )}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No notifications"
            style={{ padding: 40 }}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: item.read ? '#fff' : '#f6ffed',
                  transition: 'background-color 0.3s',
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={getNotificationIcon(item.type)}
                      style={{
                        backgroundColor:
                          item.type === 'birthday'
                            ? '#fff0f6'
                            : item.type === 'inactive'
                            ? '#fffbe6'
                            : '#e6f7ff',
                      }}
                    />
                  }
                  title={
                    <Text strong style={{ fontSize: 13 }}>
                      {item.title}
                    </Text>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.message}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(item.created_at).fromNow()}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Push notification toggle */}
        {isPushSupported() && pushPermission !== 'granted' && (
          <Tooltip title="Enable browser notifications">
            <Button 
              type="link" 
              size="small" 
              icon={<NotificationOutlined />}
              onClick={handleEnablePush}
            >
              Enable Push
            </Button>
          </Tooltip>
        )}
        {isPushSupported() && pushPermission === 'granted' && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            <NotificationOutlined /> Push enabled
          </Text>
        )}
        
        {/* Mark all as read */}
        {notifications.length > 0 && unreadCount > 0 && (
          <Button 
            type="link" 
            size="small" 
            icon={<CheckCircleOutlined />}
            onClick={handleMarkAllRead}
            loading={markingAll}
          >
            Mark all read
          </Button>
        )}
      </div>
    </div>
  );

  // Only show for admin and superadmin roles
  if (!user || !['admin', 'superadmin', 'leadpastor'].includes(user.role)) {
    return null;
  }

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      open={visible}
      onOpenChange={setVisible}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 20 }} />}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </Badge>
    </Dropdown>
  );
}
