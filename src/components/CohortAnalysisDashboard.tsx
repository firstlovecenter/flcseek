'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Segmented, Spin, Empty, Progress } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface CohortRow {
  key: string;
  label: string;
  size: number;
  retention30: number;
  retention60: number;
  retention90: number;
  completionRate: number;
  avgMilestones: number;
}

interface CohortApiRow {
  cohortKey: string;
  label: string;
  size: number;
  retention30: number;
  retention60: number;
  retention90: number;
  completionRate: number;
  avgMilestones: number;
}

interface CohortAnalysisDashboardProps {
  groupId?: string;
  months?: number;
  userId: string;
  token?: string;
}

export function CohortAnalysisDashboard({ groupId, months = 6, userId, token }: CohortAnalysisDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'compare'>('table');
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cohorts/compare?months=${months}${groupId ? `&groupId=${groupId}` : ''}`, {
          credentials: 'include',
          headers: {
            'x-user-id': userId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setRows(
            (data.cohorts as CohortApiRow[] || []).map((c) => ({
              key: c.cohortKey,
              label: c.label,
              size: c.size,
              retention30: c.retention30,
              retention60: c.retention60,
              retention90: c.retention90,
              completionRate: c.completionRate,
              avgMilestones: c.avgMilestones,
            }))
          );
          setSummary(data.summary);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, months]);

  if (loading) {
    return (
      <Card className="text-center">
        <Spin indicator={<LoadingOutlined spin style={{ fontSize: 40 }} />} />
        <p className="mt-2">Loading cohort analytics...</p>
      </Card>
    );
  }

  if (!rows.length) {
    return <Empty description="No cohort data available" />;
  }

  const columns = [
    {
      title: 'Cohort',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: 'Retention 30d',
      dataIndex: 'retention30',
      key: 'retention30',
      render: (value: number) => <Progress percent={value} size="small" strokeColor="#52c41a" />,
    },
    {
      title: 'Retention 60d',
      dataIndex: 'retention60',
      key: 'retention60',
      render: (value: number) => <Progress percent={value} size="small" strokeColor="#faad14" />,
    },
    {
      title: 'Retention 90d',
      dataIndex: 'retention90',
      key: 'retention90',
      render: (value: number) => <Progress percent={value} size="small" strokeColor="#ff4d4f" />,
    },
    {
      title: 'Completion',
      dataIndex: 'completionRate',
      key: 'completionRate',
      render: (value: number) => (
        <Tag color={value > 50 ? 'green' : value > 25 ? 'orange' : 'red'}>{value}%</Tag>
      ),
    },
    {
      title: 'Avg Milestones',
      dataIndex: 'avgMilestones',
      key: 'avgMilestones',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cohort Analysis</h3>
        <Segmented
          value={view}
          onChange={(v) => setView(v as typeof view)}
          options={[{ label: 'Table', value: 'table' }, { label: 'Highlights', value: 'compare' }]}
        />
      </div>

      {view === 'table' ? (
        <Card>
          <Table dataSource={rows} columns={columns} pagination={false} rowKey="key" size="small" />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Best 30-day Retention">
              {summary?.bestRetention30 ? (
                <Statistic
                  title={summary.bestRetention30.label}
                  value={`${summary.bestRetention30.retention30}%`}
                  suffix="Retention"
                />
              ) : (
                <Empty description="No data" />
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Best Completion Rate">
              {summary?.bestCompletion ? (
                <Statistic
                  title={summary.bestCompletion.label}
                  value={`${summary.bestCompletion.completionRate}%`}
                  suffix="Completion"
                />
              ) : (
                <Empty description="No data" />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
