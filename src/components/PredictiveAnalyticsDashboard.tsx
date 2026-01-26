'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Space,
  Button,
  Spin,
  Empty,
  Tooltip,
  Tabs,
  Segmented,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { Prediction } from '@/lib/predictive-analytics';
import dayjs from 'dayjs';

interface PredictiveAnalyticsDashboardProps {
  groupId: string;
  userId: string;
  token?: string;
}

interface GroupOutcomes {
  totalConverts: number;
  predictionsGenerated: number;
  averageCompletion: number;
  averageDropoutRisk: number;
  highRisk: number;
  onTrack: number;
  predictions: Prediction[];
}

export function PredictiveAnalyticsDashboard({ groupId, userId, token }: PredictiveAnalyticsDashboardProps) {
  const [outcomes, setOutcomes] = useState<GroupOutcomes | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'byCategory'>('overview');
  const [category, setCategory] = useState<'onTrack' | 'atRisk' | 'highRisk'>('onTrack');

  useEffect(() => {
    const fetchOutcomes = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/predictions?groupId=${groupId}`, {
          headers: {
            'x-user-id': userId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOutcomes(data.outcomes);
        }
      } catch (error) {
        console.error('Failed to fetch predictions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOutcomes();
  }, [groupId]);

  if (loading) {
    return (
      <Card className="text-center">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
        <p className="mt-4">Generating predictions...</p>
      </Card>
    );
  }

  if (!outcomes) {
    return <Empty description="Unable to load predictions" />;
  }

  const getPredictionColor = (probability: number) => {
    if (probability > 75) return 'green';
    if (probability > 50) return 'orange';
    return 'red';
  };

  const getRiskColor = (risk: number) => {
    if (risk < 30) return 'green';
    if (risk < 60) return 'orange';
    return 'red';
  };

  const predictionsColumns = [
    {
      title: 'Convert',
      key: 'convert',
      width: 150,
      render: (_: any, record: Prediction) => (
        <div>
          <div className="font-medium">{record.convertId}</div>
          <div className="text-xs text-gray-500">{record.recommendation.substring(0, 30)}...</div>
        </div>
      ),
    },
    {
      title: 'Completion',
      dataIndex: 'completionProbability',
      key: 'completionProbability',
      width: 140,
      render: (value: number) => (
        <div className="flex items-center gap-2">
          <Progress
            type="circle"
            percent={Math.round(value)}
            width={40}
            strokeColor={getPredictionColor(value)}
          />
          <span>{Math.round(value)}%</span>
        </div>
      ),
    },
    {
      title: 'Dropout Risk',
      dataIndex: 'dropoutRisk',
      key: 'dropoutRisk',
      width: 140,
      render: (value: number) => (
        <div className="flex items-center gap-2">
          <Progress
            type="circle"
            percent={Math.round(value)}
            width={40}
            strokeColor={getRiskColor(100 - value)}
          />
          <span>{Math.round(value)}%</span>
        </div>
      ),
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 120,
      render: (value: number) => (
        <Tooltip title="Confidence based on available data points">
          <Tag color={value > 80 ? 'green' : value > 60 ? 'orange' : 'red'}>
            {value}% confident
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Est. Completion',
      dataIndex: 'estimatedCompletionDate',
      key: 'estimatedCompletionDate',
      width: 130,
      render: (value?: Date) =>
        value ? (
          <span>{dayjs(value).format('MMM D, YYYY')}</span>
        ) : (
          <span className="text-gray-400">N/A</span>
        ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_: any, record: Prediction) => (
        <Button type="link" size="small">
          View Details
        </Button>
      ),
    },
  ];

  const overallStats = [
    {
      title: 'Total Converts',
      value: outcomes.totalConverts,
      icon: <TeamOutlined />,
    },
    {
      title: 'With Predictions',
      value: outcomes.predictionsGenerated,
      subtitle: `${((outcomes.predictionsGenerated / outcomes.totalConverts) * 100).toFixed(1)}%`,
    },
    {
      title: 'Avg. Completion',
      value: `${Math.round(outcomes.averageCompletion)}%`,
      color: getPredictionColor(outcomes.averageCompletion),
    },
    {
      title: 'Avg. Dropout Risk',
      value: `${Math.round(outcomes.averageDropoutRisk)}%`,
      color: getRiskColor(outcomes.averageDropoutRisk),
    },
    {
      title: 'On Track',
      value: outcomes.onTrack,
      color: 'green',
      suffix: outcomes.onTrack > 0 ? <ArrowUpOutlined /> : undefined,
    },
    {
      title: 'High Risk',
      value: outcomes.highRisk,
      color: 'red',
      suffix: outcomes.highRisk > 0 ? <ExclamationCircleOutlined /> : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Prediction Overview</h2>
        <Row gutter={[16, 16]}>
          {overallStats.map((stat, index) => (
            <Col key={index} xs={24} sm={12} lg={4}>
              <Card className="text-center">
                {stat.icon && <div className="mb-2 text-2xl">{stat.icon}</div>}
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  suffix={stat.suffix}
                  valueStyle={{ color: stat.color }}
                />
                {stat.subtitle && <div className="text-sm text-gray-500">{stat.subtitle}</div>}
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* View Toggle */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Detailed Predictions</h3>
          <Segmented
            value={view}
            onChange={(value) => setView(value as typeof view)}
            options={[
              { label: 'Overview', value: 'overview' },
              { label: 'By Category', value: 'byCategory' },
            ]}
          />
        </div>

        {view === 'overview' ? (
          <Table
            dataSource={outcomes.predictions}
            columns={predictionsColumns}
            rowKey={(record) => record.convertId}
            pagination={{
              pageSize: 10,
              total: outcomes.predictions.length,
            }}
            size="small"
          />
        ) : (
          <div>
            <Segmented
              block
              value={category}
              onChange={(value) => setCategory(value as typeof category)}
              options={[
                {
                  label: (
                    <>
                      <CheckCircleOutlined className="mr-1" />
                      On Track ({outcomes.onTrack})
                    </>
                  ),
                  value: 'onTrack',
                },
                {
                  label: (
                    <>
                      <ExclamationCircleOutlined className="mr-1" />
                      At Risk ({outcomes.predictions.length - outcomes.onTrack - outcomes.highRisk})
                    </>
                  ),
                  value: 'atRisk',
                },
                {
                  label: (
                    <>
                      <ExclamationCircleOutlined className="mr-1" />
                      High Risk ({outcomes.highRisk})
                    </>
                  ),
                  value: 'highRisk',
                },
              ]}
            />

            <div className="mt-4">
              <Table
                dataSource={
                  category === 'onTrack'
                    ? outcomes.predictions.filter((p) => p.completionProbability > 75)
                    : category === 'atRisk'
                      ? outcomes.predictions.filter(
                          (p) => p.completionProbability > 50 && p.completionProbability <= 75
                        )
                      : outcomes.predictions.filter((p) => p.completionProbability <= 50)
                }
                columns={predictionsColumns}
                rowKey={(record) => record.convertId}
                pagination={{
                  pageSize: 10,
                }}
                size="small"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Key Insights */}
      <Card title="Key Insights" type="inner">
        <div className="space-y-2">
          <p>
            <strong>Average Completion Probability:</strong> {Math.round(outcomes.averageCompletion)}%
            {outcomes.averageCompletion > 70
              ? ' - Group is on track overall'
              : outcomes.averageCompletion > 50
                ? ' - Group needs attention'
                : ' - Group requires intervention'}
          </p>
          <p>
            <strong>High Risk Converts:</strong> {outcomes.highRisk} out of {outcomes.predictionsGenerated}
            (
            {((outcomes.highRisk / outcomes.predictionsGenerated) * 100).toFixed(1)}%) require
            immediate follow-up
          </p>
          <p>
            <strong>Strong Performers:</strong> {outcomes.onTrack} converts ({((outcomes.onTrack / outcomes.predictionsGenerated) * 100).toFixed(1)}%) are
            progressing well
          </p>
        </div>
      </Card>
    </div>
  );
}
