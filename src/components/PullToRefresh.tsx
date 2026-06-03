'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { SynagoLoader } from '@/components/shell/SynagoLoader';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80;

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
    <div ref={containerRef} className="relative min-h-full">
      <div
        className={cn(
          'absolute inset-x-0 -top-10 flex h-10 items-center justify-center',
          isRefreshing && 'transition-transform duration-200'
        )}
        style={{
          transform: `translateY(${pullDistance}px)`,
          opacity: refreshOpacity,
        }}
      >
        {isRefreshing ? (
          <SynagoLoader size={20} />
        ) : (
          <Image
            src="/synago-logo.svg"
            alt=""
            width={20}
            height={20}
            aria-hidden
            className="shrink-0 object-contain"
            style={{ transform: `rotate(${refreshRotation}deg)` }}
          />
        )}
      </div>

      <div
        className={cn(
          (isRefreshing || pullDistance === 0) && 'transition-transform duration-200'
        )}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
