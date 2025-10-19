'use client';

import { useEffect, useState } from 'react';
import { Table, Button, Typography, Spin, message, Progress, Tag, Modal, Checkbox } from 'antd';
import { CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PROGRESS_STAGES } from '@/lib/constants';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface PersonProgress {
  id: string;
  full_name: string;
  department_name: string;
  completedStages: number;
  percentage: number;
}

export default function ProgressPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<PersonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [progressStages, setProgressStages] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);

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
            department_name: person.department_name,
            completedStages,
            percentage: Math.round((completedStages / 15) * 100),
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
      render: (text: string, record: PersonProgress) => (
        <Button
          type="link"
          onClick={() => router.push(`/person/${record.id}`)}
          style={{ padding: 0 }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: PersonProgress) => (
        <div style={{ width: 150 }}>
          <Progress
            percent={record.percentage}
            strokeColor="#52c41a"
            size="small"
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.completedStages}/15 stages
          </Text>
        </div>
      ),
    },
    {
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
    },
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
          <Title level={2}>Progress Tracking</Title>
          <Text type="secondary">
            Update and monitor spiritual growth stages
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={people}
          rowKey="id"
          size="small"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          style={{ background: 'white', borderRadius: 8 }}
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
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px',
                  backgroundColor: stage.is_completed ? '#f6ffed' : 'white',
                }}
              >
                <Checkbox
                  checked={stage.is_completed}
                  onChange={() => toggleStage(stage.stage_number, stage.is_completed)}
                  disabled={updating}
                >
                  <Text strong>{PROGRESS_STAGES[stage.stage_number - 1]?.name || `Stage ${stage.stage_number}`}</Text>
                </Checkbox>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    </>
  );
}
