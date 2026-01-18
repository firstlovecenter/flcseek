'use client';

import { useMemo } from 'react';
import { Card, Typography, Row, Col, Progress } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { useThemeStyles } from '@/lib/theme-utils';

const { Text, Title } = Typography;

interface PersonWithProgress {
  id: string;
  full_name: string;
  progress: Array<{
    stage_number: number;
    is_completed: boolean;
  }>;
}

interface MilestoneData {
  number: number;
  name: string;
  shortName: string;
}

interface DashboardChartsProps {
  people: PersonWithProgress[];
  milestones: MilestoneData[];
  compact?: boolean;
}

/**
 * Dashboard Charts Component
 * Displays milestone completion progress as visual charts
 */
export default function DashboardCharts({ people, milestones, compact = true }: DashboardChartsProps) {
  const themeStyles = useThemeStyles();

  // Calculate milestone completion rates
  const milestoneStats = useMemo(() => {
    if (!milestones.length || !people.length) return [];

    return milestones.map((milestone) => {
      const completedCount = people.filter((person) =>
        person.progress.some(
          (p) => p.stage_number === milestone.number && p.is_completed
        )
      ).length;

      return {
        milestone: milestone.number,
        name: milestone.shortName || milestone.name,
        fullName: milestone.name,
        completed: completedCount,
        incomplete: people.length - completedCount,
        percentage: Math.round((completedCount / people.length) * 100),
      };
    });
  }, [people, milestones]);

  // Find milestones that need attention (lowest completion rates)
  const milestonesNeedingAttention = useMemo(() => {
    return [...milestoneStats]
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 5);
  }, [milestoneStats]);

  // Calculate overall completion by person
  const personCompletionStats = useMemo(() => {
    if (!people.length || !milestones.length) return { full: 0, partial: 0, none: 0 };

    const totalMilestones = milestones.length;
    let fullCompletion = 0;
    let partialCompletion = 0;
    let noCompletion = 0;

    people.forEach((person) => {
      const completedCount = person.progress.filter((p) => p.is_completed).length;
      if (completedCount === totalMilestones) {
        fullCompletion++;
      } else if (completedCount > 0) {
        partialCompletion++;
      } else {
        noCompletion++;
      }
    });

    return {
      full: fullCompletion,
      partial: partialCompletion,
      none: noCompletion,
    };
  }, [people, milestones]);

  if (!milestones.length || !people.length) {
    return null;
  }

  if (compact) {
    // Compact view for embedding in dashboard
    return (
      <Card
        size="small"
        title={
          <span>
            <TeamOutlined style={{ marginRight: 8 }} />
            Milestone Progress Overview
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[8, 8]}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold', 
                color: themeStyles.success 
              }}>
                {personCompletionStats.full}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                <CheckCircleOutlined /> Complete
              </Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold', 
                color: themeStyles.warning 
              }}>
                {personCompletionStats.partial}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                In Progress
              </Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 'bold', 
                color: themeStyles.error 
              }}>
                {personCompletionStats.none}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                <CloseCircleOutlined /> Not Started
              </Text>
            </div>
          </Col>
        </Row>

        {/* Top 5 milestones needing attention */}
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Milestones Needing Attention:
          </Text>
          {milestonesNeedingAttention.map((stat) => (
            <div 
              key={stat.milestone} 
              style={{ marginBottom: 6 }}
              title={stat.fullName}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 11,
                marginBottom: 2
              }}>
                <Text ellipsis style={{ maxWidth: '70%' }}>
                  M{stat.milestone.toString().padStart(2, '0')}: {stat.name.split('\n')[0]}
                </Text>
                <Text type="secondary">{stat.completed}/{people.length}</Text>
              </div>
              <Progress
                percent={stat.percentage}
                size="small"
                strokeColor={
                  stat.percentage >= 70
                    ? themeStyles.success
                    : stat.percentage >= 40
                    ? themeStyles.warning
                    : themeStyles.error
                }
                showInfo={false}
              />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Full view with more detailed charts
  return (
    <div style={{ marginBottom: 24 }}>
      <Title level={4}>
        <TeamOutlined style={{ marginRight: 8 }} />
        Progress Analytics
      </Title>
      
      <Row gutter={[16, 16]}>
        {/* Summary Cards */}
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 48, 
                fontWeight: 'bold', 
                color: themeStyles.success 
              }}>
                {personCompletionStats.full}
              </div>
              <Text>Fully Completed</Text>
              <Progress 
                percent={Math.round((personCompletionStats.full / people.length) * 100)} 
                strokeColor={themeStyles.success}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 48, 
                fontWeight: 'bold', 
                color: themeStyles.warning 
              }}>
                {personCompletionStats.partial}
              </div>
              <Text>In Progress</Text>
              <Progress 
                percent={Math.round((personCompletionStats.partial / people.length) * 100)} 
                strokeColor={themeStyles.warning}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 48, 
                fontWeight: 'bold', 
                color: themeStyles.error 
              }}>
                {personCompletionStats.none}
              </div>
              <Text>Not Started</Text>
              <Progress 
                percent={Math.round((personCompletionStats.none / people.length) * 100)} 
                strokeColor={themeStyles.error}
              />
            </div>
          </Card>
        </Col>

        {/* All Milestones Progress */}
        <Col span={24}>
          <Card title="Milestone Completion Rates">
            <Row gutter={[8, 8]}>
              {milestoneStats.map((stat) => (
                <Col key={stat.milestone} xs={12} sm={8} md={6} lg={4}>
                  <div 
                    style={{ 
                      padding: 8, 
                      textAlign: 'center',
                      border: '1px solid #f0f0f0',
                      borderRadius: 4
                    }}
                    title={stat.fullName}
                  >
                    <Text strong style={{ display: 'block', fontSize: 11 }}>
                      M{stat.milestone.toString().padStart(2, '0')}
                    </Text>
                    <Progress
                      type="circle"
                      percent={stat.percentage}
                      size={50}
                      strokeColor={
                        stat.percentage >= 70
                          ? themeStyles.success
                          : stat.percentage >= 40
                          ? themeStyles.warning
                          : themeStyles.error
                      }
                    />
                    <Text 
                      type="secondary" 
                      style={{ display: 'block', fontSize: 10, marginTop: 4 }}
                      ellipsis
                    >
                      {stat.name.split('\n')[0]}
                    </Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
