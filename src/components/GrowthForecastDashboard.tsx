'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Empty, Progress } from 'antd';
import { LoadingOutlined, LineChartOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface GrowthForecastDashboardProps {
  groupId?: string;
  userId: string;
  token?: string;
}

interface ForecastApiResponse {
  success: boolean;
  forecast: {
    groupId?: string;
    weeksAnalyzed: number;
    history: { weekStart: string; attendanceCount: number; milestoneCompletions: number }[];
    forecast: { weekStart: string; attendanceForecast: number; milestoneForecast: number }[];
    trend: {
      attendanceSlope: number;
      milestoneSlope: number;
      attendanceDirection: 'up' | 'flat' | 'down';
      milestoneDirection: 'up' | 'flat' | 'down';
    };
  };
}

export function GrowthForecastDashboard({ groupId, userId, token }: GrowthForecastDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ForecastApiResponse['forecast'] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/forecast${groupId ? `?groupId=${groupId}` : ''}`, {
          headers: {
            'x-user-id': userId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        if (json.success) {
          setData(json.forecast);
        }
      } catch (error) {
        console.error('Failed to load forecast', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, userId, token]);

  if (loading) {
    return (
      <Card className="text-center">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
        <p className="mt-2">Generating forecasts...</p>
      </Card>
    );
  }

  if (!data) {
    return <Empty description="No forecast data available" />;
  }

  const directionTag = (dir: 'up' | 'flat' | 'down') => {
    const color = dir === 'up' ? 'green' : dir === 'down' ? 'red' : 'blue';
    const icon = dir === 'up' ? <RiseOutlined /> : dir === 'down' ? <FallOutlined /> : <LineChartOutlined />;
    return (
      <Tag color={color} icon={icon}>
        {dir.toUpperCase()}
      </Tag>
    );
  };

  const historyRows = data.history.map((h) => ({
    key: h.weekStart,
    week: dayjs(h.weekStart).format('MMM D'),
    attendance: h.attendanceCount,
    milestones: h.milestoneCompletions,
  }));

  const forecastRows = data.forecast.map((f) => ({
    key: f.weekStart,
    week: dayjs(f.weekStart).format('MMM D'),
    attendance: f.attendanceForecast,
    milestones: f.milestoneForecast,
  }));

  return (
    <div className="space-y-4">
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Attendance Trend" size="small">
            <Statistic
              title="Slope"
              value={data.trend.attendanceSlope.toFixed(2)}
              prefix={directionTag(data.trend.attendanceDirection)}
            />
            <Progress
              percent={Math.min(Math.max(data.trend.attendanceSlope * 10 + 50, 0), 100)}
              size="small"
              strokeColor="#1677ff"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Milestone Trend" size="small">
            <Statistic
              title="Slope"
              value={data.trend.milestoneSlope.toFixed(2)}
              prefix={directionTag(data.trend.milestoneDirection)}
            />
            <Progress
              percent={Math.min(Math.max(data.trend.milestoneSlope * 10 + 50, 0), 100)}
              size="small"
              strokeColor="#52c41a"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="History (last weeks)" size="small">
            <Table
              dataSource={historyRows}
              columns={[
                { title: 'Week', dataIndex: 'week', key: 'week' },
                { title: 'Attendance', dataIndex: 'attendance', key: 'attendance' },
                { title: 'Milestones', dataIndex: 'milestones', key: 'milestones' },
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Forecast (next weeks)" size="small">
            <Table
              dataSource={forecastRows}
              columns={[
                { title: 'Week', dataIndex: 'week', key: 'week' },
                { title: 'Attendance (forecast)', dataIndex: 'attendance', key: 'attendance' },
                { title: 'Milestones (forecast)', dataIndex: 'milestones', key: 'milestones' },
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
