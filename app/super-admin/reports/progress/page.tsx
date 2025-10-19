'use client';

import { useEffect, useState } from 'react';
import { Card, Typography, Spin, Progress, Row, Col, Statistic, Table } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { PROGRESS_STAGES } from '@/lib/constants';

const { Title, Text } = Typography;

interface StageCompletion {
  stage: string;
  completed: number;
  total: number;
  percentage: number;
}

export default function ProgressReportPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stageData, setStageData] = useState<StageCompletion[]>([]);
  const [overallStats, setOverallStats] = useState({ avgCompletion: 0, totalPeople: 0 });

  useEffect(() => {
    if (token) {
      fetchProgressData();
    }
  }, [token]);

  const fetchProgressData = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const people = data.people || [];

      const allProgress = await Promise.all(
        people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();
          return details.progress || [];
        })
      );

      const flatProgress = allProgress.flat();
      const totalPeople = people.length;

      const stages: StageCompletion[] = PROGRESS_STAGES.map((stage, index) => {
        const stageProgress = flatProgress.filter((p: any) => p.stage_number === index + 1);
        const completed = stageProgress.filter((p: any) => p.is_completed).length;
        return {
          stage: stage.name,
          completed,
          total: totalPeople,
          percentage: totalPeople ? Math.round((completed / totalPeople) * 100) : 0,
        };
      });

      const avgCompletion = Math.round(
        stages.reduce((sum, s) => sum + s.percentage, 0) / stages.length
      );

      setStageData(stages);
      setOverallStats({ avgCompletion, totalPeople });
    } catch (error) {
      console.error('Failed to fetch progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      width: 300,
    },
    {
      title: 'Completed',
      key: 'completed',
      render: (_: any, record: StageCompletion) => `${record.completed} / ${record.total}`,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: StageCompletion) => (
        <Progress percent={record.percentage} strokeColor="#52c41a" />
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <AppBreadcrumb />
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={2}>Progress Report</Title>
          <Text type="secondary">Detailed breakdown of completion stages across all members</Text>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="Total People Being Tracked"
                value={overallStats.totalPeople}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="Average Stage Completion"
                value={overallStats.avgCompletion}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Stage-by-Stage Completion">
          <Table
            columns={columns}
            dataSource={stageData}
            rowKey="stage"
            pagination={false}
          />
        </Card>
      </div>
    </>
  );
}
