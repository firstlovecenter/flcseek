'use client';

import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { CHART_HEX } from '@/lib/chart-colors';

interface MilestoneCompletion {
  milestone: string;
  fullName?: string;
  completed: number;
  total: number;
  percentage: number;
}

function getBarColor(percentage: number) {
  if (percentage >= 70) return CHART_HEX.success;
  if (percentage >= 40) return CHART_HEX.warning;
  return CHART_HEX.destructive;
}

function ChartFrame({
  height,
  children,
}: {
  height: number;
  children: ReactElement;
}) {
  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function MilestoneBarChart({ data }: { data: MilestoneCompletion[] }) {
  return (
    <ChartFrame height={300}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_HEX.grid} />
        <XAxis dataKey="milestone" tick={{ fontSize: 12, fill: 'currentColor' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'currentColor' }} unit="%" />
        <Tooltip
          formatter={(value: number, _name, props) => {
            const item = props.payload as MilestoneCompletion;
            return [
              `${item.completed}/${item.total} (${value}%)`,
              item.fullName || item.milestone,
            ];
          }}
        />
        <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.percentage)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function GenderPieChart({ data }: { data: { gender: string; count: number }[] }) {
  return (
    <ChartFrame height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="gender"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          label={({ gender, percent }) =>
            `${gender}: ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_HEX.series[index % CHART_HEX.series.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ChartFrame>
  );
}

export function GroupBarChart({ data }: { data: { group: string; count: number }[] }) {
  return (
    <ChartFrame height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_HEX.grid} />
        <XAxis
          dataKey="group"
          tick={{ fontSize: 11, fill: 'currentColor' }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill={CHART_HEX.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function RegistrationsLineChart({
  data,
}: {
  data: { month: string; count: number }[];
}) {
  return (
    <ChartFrame height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_HEX.grid} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'currentColor' }} />
        <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} allowDecimals={false} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          stroke={CHART_HEX.success}
          strokeWidth={2}
          dot={{ r: 4, fill: CHART_HEX.success }}
        />
      </LineChart>
    </ChartFrame>
  );
}
