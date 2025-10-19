'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80; // Distance needed to trigger refresh

  const handleTouchStart = (e: TouchEvent) => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isRefreshing) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop === 0 && touchStart > 0) {
      const currentTouch = e.touches[0].clientY;
      const distance = currentTouch - touchStart;
      
      if (distance > 0) {
        // Prevent default scrolling when pulling down
        e.preventDefault();
        setPullDistance(Math.min(distance, threshold * 1.5));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    setTouchStart(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, pullDistance, isRefreshing]);

  const refreshOpacity = Math.min(pullDistance / threshold, 1);
  const refreshRotation = (pullDistance / threshold) * 360;

  return (
    <div ref={containerRef} style={{ position: 'relative', minHeight: '100%' }}>
      {/* Pull indicator */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          left: 0,
          right: 0,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${pullDistance}px)`,
          opacity: refreshOpacity,
          transition: isRefreshing ? 'transform 0.2s' : 'none',
        }}
      >
        {isRefreshing ? (
          <Spin size="small" />
        ) : (
          <ReloadOutlined
            style={{
              fontSize: 20,
              color: '#1890ff',
              transform: `rotate(${refreshRotation}deg)`,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.2s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
