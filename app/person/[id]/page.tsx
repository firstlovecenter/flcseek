'use client';

import { useEffect, useState } from 'react';
import {
  Tabs,
  Typography,
  Spin,
  message,
  Card,
  Switch,
  Table,
  Button,
  Space,
  Progress,
  Tag,
  Modal,
  Form,
  DatePicker,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { ATTENDANCE_GOAL } from '@/lib/constants';
import dayjs from 'dayjs';
import TopNav from '@/components/TopNav';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

interface ProgressRecord {
  id: string;
  stage_number: number;
  stage_name: string;
  is_completed: boolean;
  date_completed?: string;
}

interface AttendanceRecord {
  id: string;
  date_attended: string;
  created_at: string;
}

export default function PersonDetailPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [person, setPerson] = useState<any>(null);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    if (user && token && params.id) {
      fetchPersonDetails();
    }
  }, [user, token, authLoading, params.id, router]);

  const fetchPersonDetails = async () => {
    try {
      const response = await fetch(`/api/people/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch person details');

      const data = await response.json();
      setPerson(data.person);
      setProgress(data.progress || []);
      setAttendance(data.attendance || []);
    } catch (error: any) {
      message.error(error.message || 'Failed to load person details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleProgressToggle = async (stageNumber: number, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/progress/${params.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage_number: stageNumber,
          is_completed: isCompleted,
        }),
      });

      if (!response.ok) throw new Error('Failed to update progress');

      message.success(
        isCompleted ? 'Stage marked as completed!' : 'Stage marked as incomplete'
      );
      fetchPersonDetails();
    } catch (error: any) {
      message.error(error.message || 'Failed to update progress');
    }
  };

  const handleAddAttendance = async (values: any) => {
    try {
      const response = await fetch(`/api/attendance/${params.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date_attended: values.date_attended.format('YYYY-MM-DD'),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add attendance');
      }

      message.success('Attendance recorded successfully!');
      form.resetFields();
      setAttendanceModalVisible(false);
      fetchPersonDetails();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const progressColumns = [
    {
      title: '#',
      dataIndex: 'stage_number',
      key: 'stage_number',
      width: 60,
    },
    {
      title: 'Stage',
      dataIndex: 'stage_name',
      key: 'stage_name',
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: ProgressRecord) => (
        <Tag
          icon={record.is_completed ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={record.is_completed ? 'success' : 'default'}
        >
          {record.is_completed ? 'Completed' : 'Pending'}
        </Tag>
      ),
    },
    {
      title: 'Date Completed',
      dataIndex: 'date_completed',
      key: 'date_completed',
      width: 150,
      render: (date: string) =>
        date ? dayjs(date).format('MMM DD, YYYY') : '-',
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_: any, record: ProgressRecord) => {
        // Milestone 18 is auto-calculated from attendance
        if (record.stage_number === 18) {
          return (
            <Tooltip title="Auto-calculated from attendance records">
              <Tag icon={<InfoCircleOutlined />} color="blue">
                Auto
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Switch
            checked={record.is_completed}
            onChange={(checked) => handleProgressToggle(record.stage_number, checked)}
            checkedChildren="Done"
            unCheckedChildren="Todo"
          />
        );
      },
    },
  ];

  const attendanceColumns = [
    {
      title: 'Date',
      dataIndex: 'date_attended',
      key: 'date_attended',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Recorded At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY h:mm A'),
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const completedStages = progress.filter((p) => p.is_completed).length;
  const totalStages = progress.length || 18; // Use actual milestone count
  const progressPercentage = Math.round((completedStages / totalStages) * 100);
  const attendancePercentage = Math.min(
    Math.round((attendance.length / ATTENDANCE_GOAL) * 100),
    100
  );

  // Determine back URL based on user role
  let backUrl = '/sheep-seeker';
  if (user?.role === 'superadmin') {
    backUrl = '/superadmin';
  } else if (user?.role === 'leadpastor') {
    backUrl = '/leadpastor';
  }

  return (
    <>
      <TopNav 
        title={person?.full_name || 'Person Details'} 
        showBack={true} 
        backUrl={backUrl}
      />
      <div style={{ padding: '24px' }}>
        <AppBreadcrumb />
        <div
          style={{
            margin: '8px 0 16px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Space wrap>
            <Button onClick={() => router.push(backUrl)}>Home</Button>
            {(user?.role === 'admin' || user?.role === 'leader') && (
              <>
                <Button onClick={() => router.push('/sheep-seeker/people')}>New Converts</Button>
                <Button onClick={() => router.push('/sheep-seeker/attendance')}>Attendance</Button>
                <Button onClick={() => router.push('/sheep-seeker/progress')}>Progress</Button>
              </>
            )}
          </Space>
        </div>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <Text type="secondary">Phone:</Text>
                <Title level={4} style={{ margin: '4px 0' }}>
                  <a href={`tel:${person?.phone_number}`} style={{ color: '#1890ff', textDecoration: 'none' }}>
                    {person?.phone_number}
                  </a>
                </Title>
              </div>
              {user?.role === 'superadmin' && (
                <div>
                  <Text type="secondary">Department:</Text>
                  <Title level={4} style={{ margin: '4px 0' }}>
                    {person?.department_name}
                  </Title>
                </div>
              )}
              <div>
                <Text type="secondary">Gender:</Text>
                <Title level={4} style={{ margin: '4px 0' }}>
                  {person?.gender || 'N/A'}
                </Title>
              </div>
            </div>
            
            {(person?.home_location || person?.work_location) && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                  {person?.home_location && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <HomeOutlined style={{ color: '#1890ff' }} />
                        <Text type="secondary">Home Location:</Text>
                      </div>
                      <Text strong>{person.home_location}</Text>
                    </div>
                  )}
                  {person?.work_location && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <EnvironmentOutlined style={{ color: '#52c41a' }} />
                        <Text type="secondary">Work Location:</Text>
                      </div>
                      <Text strong>{person.work_location}</Text>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Tabs
            defaultActiveKey="progress"
            size="large"
            items={[
              {
                key: 'progress',
                label: 'Milestone Tracker',
                children: (
                  <Card>
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <Text strong>Overall Progress</Text>
                        <Text strong>
                          {completedStages} / 15 stages completed
                        </Text>
                      </div>
                      <Progress
                        percent={progressPercentage}
                        strokeColor="#003366"
                        strokeWidth={12}
                      />
                    </div>
                    <Table
                      columns={progressColumns}
                      dataSource={progress}
                      rowKey="id"
                      pagination={false}
                    />
                  </Card>
                ),
              },
              {
                key: 'attendance',
                label: 'Attendance Tracker',
                children: (
                  <Card>
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <Text strong style={{ fontSize: 16 }}>
                            Attendance Progress
                          </Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary">
                              {attendance.length} / {ATTENDANCE_GOAL} attendances
                            </Text>
                            {attendance.length >= ATTENDANCE_GOAL && (
                              <Tag color="success" style={{ marginLeft: 8 }}>
                                Completed!
                              </Tag>
                            )}
                          </div>
                        </div>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            // Calculate the most recent Sunday
                            const today = dayjs();
                            const mostRecentSunday = today.day() === 0 
                              ? today 
                              : today.subtract(today.day(), 'day');
                            
                            // Set default value to most recent Sunday
                            form.setFieldsValue({ date_attended: mostRecentSunday });
                            setAttendanceModalVisible(true);
                          }}
                        >
                          Add Attendance
                        </Button>
                      </div>
                      <Progress
                        percent={attendancePercentage}
                        strokeColor="#00b300"
                        strokeWidth={12}
                        format={() => `${attendance.length}/${ATTENDANCE_GOAL}`}
                      />
                    </div>
                    <Table
                      columns={attendanceColumns}
                      dataSource={attendance}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </div>
      </div>

      <Modal
        title="Add Attendance"
        open={attendanceModalVisible}
        onCancel={() => {
          setAttendanceModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleAddAttendance} layout="vertical">
          <Form.Item
            name="date_attended"
            label="Attendance Date (Sundays only)"
            rules={[{ required: true, message: 'Please select date' }]}
            extra="You can only record attendance for the most recent Sunday"
          >
            <DatePicker 
              style={{ width: '100%' }} 
              disabledDate={(current) => {
                if (!current) return false;
                
                const today = dayjs();
                
                // Disable if not a Sunday (day 0)
                if (current.day() !== 0) return true;
                
                // Calculate the most recent Sunday (or today if today is Sunday)
                const mostRecentSunday = today.day() === 0 
                  ? today 
                  : today.subtract(today.day(), 'day');
                
                // Only allow the most recent Sunday - disable all other dates
                if (!current.isSame(mostRecentSunday, 'day')) return true;
                
                return false;
              }}
              format="YYYY-MM-DD"
              placeholder="Select the most recent Sunday"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Record Attendance
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
