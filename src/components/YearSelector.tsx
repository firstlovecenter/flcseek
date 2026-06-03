'use client';

import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CURRENT_YEAR } from '@/lib/constants';
import { api } from '@/lib/api';
import type { GroupApiData } from '@/lib/types/api-responses';

interface YearSelectorProps {
  value: number | null;
  onChange: (year: number) => void;
  groupName?: string;
  showLabel?: boolean;
  style?: React.CSSProperties;
}

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
          const groups: GroupApiData[] = (response.data?.groups as GroupApiData[]) || [];

          const filteredGroups = groupName
            ? groups.filter((g) => g.name.toLowerCase() === groupName.toLowerCase())
            : groups;

          const years = Array.from(new Set(filteredGroups.map((g) => g.year))).sort(
            (a, b) => b - a
          );

          setAvailableYears(years);

          if (!value && years.length > 0) {
            onChange(years[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch available years:', error);
        setAvailableYears([CURRENT_YEAR, CURRENT_YEAR - 1]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableYears();
  }, [token, groupName]);

  if (availableYears.length <= 1) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2')} style={style}>
      {showLabel && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          Year:
        </span>
      )}
      {loading ? (
        <Skeleton className="h-9 w-[100px]" />
      ) : (
        <Select
          value={value?.toString()}
          onValueChange={(v) => onChange(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
