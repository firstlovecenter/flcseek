'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, Modal, Checkbox, Space } from 'antd';
import { CheckCircleOutlined, EyeOutlined, HomeOutlined, TeamOutlined, CheckOutlined, BarChartOutlined, UserAddOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { useThemeStyles } from '@/lib/theme-utils';

const { Title, Text } = Typography;

interface Milestone {
  stage_number: number;
  stage_name: string;
  short_name?: string;
}

interface PersonProgress {
  id: string;
  full_name: string;
  group_name: string;
  phone_number: string;
  completedStages: number;
  percentage: number;
}

export default function ProgressPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<PersonProgress[]>([]);
  const themeStyles = useThemeStyles();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [progressStages, setProgressStages] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  
  // Check if user is a leader (read-only access) or superadmin (full edit access)
  const isLeader = user?.role === 'leader';
  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    if (user && token) {
      fetchPeople();
    }
  }, [user, token, authLoading, router]);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch people');

      const data = await response.json();

      const peopleWithProgress = await Promise.all(
        data.people.map(async (person: any) => {
          const detailsRes = await fetch(`/api/people/${person.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const details = await detailsRes.json();
          const completedStages = details.progress?.filter((p: any) => p.is_completed).length || 0;

          return {
            id: person.id,
            full_name: person.full_name,
            group_name: person.group_name,
            phone_number: person.phone_number,
            completedStages,
            percentage: Math.round((completedStages / 18) * 100),
          };
        })
      );

      setPeople(peopleWithProgress);
    } catch (error: any) {
      message.error(error.message || 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  const openProgressModal = async (person: PersonProgress) => {
    try {
      const response = await fetch(`/api/people/${person.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const details = await response.json();
      
      setSelectedPerson(person);
      setProgressStages(details.progress || []);
      setModalVisible(true);
    } catch (error: any) {
      message.error(error.message || 'Failed to load progress details');
    }
  };

  const toggleStage = async (stageNumber: number, isCompleted: boolean) => {
    // Milestone 1 cannot be edited by anyone
    if (stageNumber === 1) {
      message.warning('Milestone 1 is automatically completed on registration and cannot be edited');
      return;
    }

    // Milestone 18 (Attendance) cannot be manually edited
    if (stageNumber === 18) {
      message.warning('Attendance milestone is automatically calculated from attendance records');
      return;
    }

    // Only superadmin can toggle a completed milestone back to incomplete
    if (isCompleted && !isSuperAdmin) {
      message.warning('Only superadmins can edit completed milestones');
      return;
    }
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/progress/${selectedPerson.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage_number: stageNumber,
          is_completed: !isCompleted,
        }),
      });

      if (!response.ok) throw new Error('Failed to update progress');

      message.success('Progress updated successfully!');
      
      // Refresh progress stages
      const detailsRes = await fetch(`/api/people/${selectedPerson.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const details = await detailsRes.json();
      setProgressStages(details.progress || []);
      
      // Refresh people list
      fetchPeople();
    } catch (error: any) {
      message.error(error.message || 'Failed to update progress');
    } finally {
      setUpdating(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: isLeader ? 200 : undefined,
      render: (text: string, record: PersonProgress) => (
        <div>
          <Button
            type="link"
            onClick={() => router.push(`/person/${record.id}`)}
            style={{ padding: 0 }}
          >
            {text}
          </Button>
          {isLeader && (
            <div style={{ fontSize: 12, color: '#888' }}>
              <a href={`tel:${record.phone_number}`} style={{ color: '#888' }}>
                📞 {record.phone_number}
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Completed Stages',
      key: 'completed',
      width: isLeader ? 100 : undefined,
      render: (_: any, record: PersonProgress) => (
        <Tag color="blue">{record.completedStages}/18</Tag>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: PersonProgress) => (
        <div style={{ width: isLeader ? undefined : 150 }}>
          <Progress
            percent={record.percentage}
            strokeColor="#52c41a"
            size="small"
          />
        </div>
      ),
    },
    // Only show Actions column for admins (not for leaders)
    ...(!isLeader ? [{
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: PersonProgress) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => openProgressModal(record)}
          >
            Update Progress
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/person/${record.id}`)}
          >
            View
          </Button>
        </div>
      ),
    }] : []),
  ];

  if (authLoading || loading) {
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={2} style={{ margin: 0 }}>Milestone Tracking</Title>
            <Space>
              <Button
                icon={<HomeOutlined />}
                onClick={() => router.push('/sheep-seeker')}
              >
                Home
              </Button>
              <Button
                icon={<BarChartOutlined />}
                type="primary"
              >
                Milestones
              </Button>
              <Button
                icon={<TeamOutlined />}
                onClick={() => router.push('/sheep-seeker/attendance')}
              >
                Attendance
              </Button>
              {!isLeader && (
                <Button
                  icon={<UserAddOutlined />}
                  onClick={() => router.push('/sheep-seeker/people/register')}
                >
                  Register
                </Button>
              )}
              {!isLeader && (
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={() => router.push('/sheep-seeker/people/bulk-register')}
                >
                  Bulk Register
                </Button>
              )}
            </Space>
          </div>
          <Text type="secondary">
            {isLeader 
              ? 'View spiritual growth milestones for all new converts'
              : 'Update and monitor spiritual growth milestones'
            }
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="small"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          style={{ background: themeStyles.containerBg, borderRadius: 8 }}
        />

        <Modal
          title={`Update Progress - ${selectedPerson?.full_name}`}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          width={600}
        >
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {progressStages.map((stage: any) => (
              <div
                key={stage.stage_number}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  border: `1px solid ${themeStyles.border}`,
                  borderRadius: '8px',
                  backgroundColor: stage.is_completed ? themeStyles.successBg : themeStyles.containerBg,
                }}
              >
                <Checkbox
                  checked={stage.is_completed}
                  onChange={() => toggleStage(stage.stage_number, stage.is_completed)}
                  disabled={updating || stage.stage_number === 1 || stage.stage_number === 18 || (stage.is_completed && !isSuperAdmin)}
                >
                  <Text strong>{milestones.find(m => m.stage_number === stage.stage_number)?.stage_name || `Stage ${stage.stage_number}`}</Text>
                  {stage.stage_number === 1 && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      (Auto-completed on registration)
                    </Text>
                  )}
                  {stage.stage_number === 18 && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      (Auto-calculated from attendance)
                    </Text>
                  )}
                  {stage.is_completed && !isSuperAdmin && stage.stage_number !== 1 && stage.stage_number !== 18 && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      (Completed - Contact superadmin to edit)
                    </Text>
                  )}
                </Checkbox>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    </>
  );
}
