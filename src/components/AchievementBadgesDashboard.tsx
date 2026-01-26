'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Spin,
  Empty,
  Progress,
  Row,
  Col,
  Badge as AntBadge,
  Tag,
  Tooltip,
  Button,
  Alert,
  Tabs,
  Statistic,
  Space,
} from 'antd';
import { TrophyOutlined, FireOutlined, StarOutlined, CrownOutlined } from '@ant-design/icons';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: {
    type: 'milestone' | 'attendance' | 'consistency' | 'custom';
    value: number;
    description: string;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  points: number;
  createdAt: Date;
}

interface BadgeProgress {
  badge: Badge;
  progress: number;
  earned: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  badgesEarned: number;
  lastBadgeEarned?: Date;
}

interface AchievementBadgesDashboardProps {
  groupId?: string;
  userId?: string;
  token?: string;
}

export function AchievementBadgesDashboard({
  groupId,
  userId,
  token,
}: AchievementBadgesDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId, groupId]);

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Load all badges
      const badgesRes = await fetch('/api/badges', {
        headers: { 'X-User-ID': userId },
      });

      if (!badgesRes.ok) throw new Error('Failed to load badges');
      const badgesData = await badgesRes.json();
      setBadges(badgesData.badges || []);

      // Load badge progress
      const progressRes = await fetch(`/api/badges/${userId}?action=progress`, {
        headers: { 'X-User-ID': userId },
      });

      if (progressRes.ok) {
        const progressData = await progressRes.json();
        setBadgeProgress(progressData.progress || []);
      }

      // Load leaderboard
      const leaderboardRes = await fetch(
        `/api/badges/leaderboard?${groupId ? `groupId=${groupId}&` : ''}limit=20`,
        {
          headers: { 'X-User-ID': userId },
        }
      );

      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setLeaderboard(leaderboardData.leaderboard || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return '#FFD700';
      case 'rare':
        return '#9370DB';
      case 'uncommon':
        return '#4169E1';
      case 'common':
      default:
        return '#A9A9A9';
    }
  };

  const earnedCount = badgeProgress.filter((b) => b.earned).length;

  const progressColumns = [
    {
      title: 'Badge',
      dataIndex: 'badge',
      key: 'badge',
      render: (_: any, record: BadgeProgress) => (
        <Tooltip title={record.badge.description}>
          <span>
            <span style={{ fontSize: 24, marginRight: 8 }}>{record.badge.icon}</span>
            {record.badge.name}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: BadgeProgress) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            type="circle"
            percent={Math.round(progress)}
            width={40}
            strokeColor={
              record.earned
                ? '#52c41a'
                : getRarityColor(record.badge.rarity)
            }
          />
          <span>{Math.round(progress)}%</span>
          {record.earned && (
            <Tag color="success">Earned</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Rarity',
      dataIndex: 'badge.rarity',
      key: 'rarity',
      render: (rarity: string) => (
        <AntBadge
          color={getRarityColor(rarity)}
          text={rarity.toUpperCase()}
        />
      ),
    },
    {
      title: 'Criteria',
      dataIndex: 'badge.criteria.description',
      key: 'criteria',
    },
  ];

  const leaderboardColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      render: (rank: number) => {
        let icon = null;
        if (rank === 1) icon = <CrownOutlined style={{ color: '#FFD700' }} />;
        else if (rank === 2) icon = <CrownOutlined style={{ color: '#C0C0C0' }} />;
        else if (rank === 3) icon = <CrownOutlined style={{ color: '#CD7F32' }} />;

        return (
          <Space>
            {icon}
            <strong>#{rank}</strong>
          </Space>
        );
      },
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Badges Earned',
      dataIndex: 'badgesEarned',
      key: 'badgesEarned',
      render: (count: number) => (
        <Tag color="blue">
          <TrophyOutlined /> {count} badges
        </Tag>
      ),
    },
    {
      title: 'Last Achievement',
      dataIndex: 'lastBadgeEarned',
      key: 'lastBadgeEarned',
      render: (date?: string) => (
        <span>{date ? new Date(date).toLocaleDateString() : '—'}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <div style={{ marginTop: 16 }}>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Badges Earned"
                        value={earnedCount}
                        prefix={<TrophyOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Available Badges"
                        value={badges.length}
                        prefix={<StarOutlined />}
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Completion"
                        value={(earnedCount / badges.length * 100).toFixed(0)}
                        suffix="%"
                        prefix={<FireOutlined />}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Total Points"
                        value={badgeProgress
                          .filter((b) => b.earned)
                          .reduce((sum, b) => sum + b.badge.points, 0)}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card title="Your Badges" size="small">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {badgeProgress
                      .filter((b) => b.earned)
                      .map((b) => (
                        <Tooltip
                          key={b.badge.id}
                          title={`${b.badge.name}\n${b.badge.description}\n+${b.badge.points} points`}
                        >
                          <div
                            style={{
                              fontSize: 32,
                              cursor: 'pointer',
                              opacity: 1,
                              transition: 'transform 0.2s',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.transform = 'scale(1.2)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.transform = 'scale(1)')
                            }
                          >
                            {b.badge.icon}
                          </div>
                        </Tooltip>
                      ))}
                  </div>
                  {earnedCount === 0 && (
                    <Empty
                      description="No badges earned yet"
                      style={{ marginTop: 16 }}
                    />
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: 'progress',
            label: 'Badge Progress',
            children: (
              <div style={{ marginTop: 16 }}>
                <Table
                  columns={progressColumns}
                  dataSource={badgeProgress}
                  rowKey="badge.id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              </div>
            ),
          },
          {
            key: 'leaderboard',
            label: 'Leaderboard',
            children: (
              <div style={{ marginTop: 16 }}>
                {leaderboard.length === 0 ? (
                  <Empty description="No leaderboard data" />
                ) : (
                  <Table
                    columns={leaderboardColumns}
                    dataSource={leaderboard}
                    rowKey="userId"
                    pagination={{ pageSize: 20 }}
                    size="small"
                  />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
