'use client';

import { useState, useEffect } from 'react';
import { Select, Space, Typography } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { CURRENT_YEAR, MIN_YEAR } from '@/lib/constants';
import { api } from '@/lib/api';

const { Text } = Typography;

interface YearSelectorProps {
  value: number | null;
  onChange: (year: number) => void;
  groupName?: string; // The month name to filter groups by
  showLabel?: boolean;
  style?: React.CSSProperties;
}

/**
 * Year Selector Component
 * Allows admins/leaders to switch between years for their assigned month
 */
export default function YearSelector({
  value,
  onChange,
  groupName,
  showLabel = true,
  style,
}: YearSelectorProps) {
  const { token } = useAuth();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvailableYears = async () => {
      if (!token) return;

      try {
        const response = await api.groups.list({ active: true });

        if (response.success && response.data) {
          const groups = response.data || [];

          // Filter by month name if provided
          const filteredGroups = groupName
            ? groups.filter((g: any) => g.name.toLowerCase() === groupName.toLowerCase())
            : groups;

          // Extract unique years
          const years = Array.from(new Set(filteredGroups.map((g: any) => g.year))) as number[];
          years.sort((a, b) => b - a); // Descending order

          setAvailableYears(years);

          // If no value set and years are available, default to most recent
          if (!value && years.length > 0) {
            onChange(years[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch available years:', error);
        // Fallback to default years
        setAvailableYears([CURRENT_YEAR, CURRENT_YEAR - 1]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableYears();
  }, [token, groupName]);

  if (availableYears.length <= 1) {
    // Don't show selector if only one year available
    return null;
  }

  return (
    <Space style={style}>
      {showLabel && (
        <Text type="secondary">
          <CalendarOutlined /> Year:
        </Text>
      )}
      <Select
        value={value}
        onChange={onChange}
        loading={loading}
        style={{ width: 100 }}
        options={availableYears.map((year) => ({
          label: year.toString(),
          value: year,
        }))}
        placeholder="Select year"
      />
    </Space>
  );
}
