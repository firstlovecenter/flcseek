'use client';

import { useEffect, useState } from 'react';
import {
  Typography,
  Spin,
  message,
  Card,
  Button,
  Space,
  Descriptions,
} from 'antd';
import {
  HomeOutlined,
  EnvironmentOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  TeamOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import TopNav from '@/components/TopNav';
import AppBreadcrumb from '@/components/AppBreadcrumb';

const { Title, Text } = Typography;

export default function PersonDetailPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    } catch (error: any) {
      message.error(error.message || 'Failed to load person details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

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
        title={person?.full_name || `${person?.first_name} ${person?.last_name}`} 
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
          </Space>
        </div>
        
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Card>
            <Title level={3} style={{ marginBottom: 24 }}>
              <UserOutlined /> Personal Information
            </Title>
            
            <Descriptions bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }} size="middle">
              <Descriptions.Item label={<span><UserOutlined /> First Name</span>}>
                <Text strong>{person?.first_name || 'N/A'}</Text>
              </Descriptions.Item>
              
              <Descriptions.Item label={<span><UserOutlined /> Last Name</span>}>
                <Text strong>{person?.last_name || 'N/A'}</Text>
              </Descriptions.Item>
              
              <Descriptions.Item label={<span><PhoneOutlined /> Phone Number</span>}>
                <a href={`tel:${person?.phone_number}`} style={{ color: '#1890ff', textDecoration: 'none', fontWeight: 500 }}>
                  {person?.phone_number}
                </a>
              </Descriptions.Item>
              
              <Descriptions.Item label={<span><CalendarOutlined /> Date of Birth</span>}>
                <Text strong>{person?.date_of_birth || 'N/A'}</Text>
              </Descriptions.Item>
              
              <Descriptions.Item label={<span><UserOutlined /> Gender</span>}>
                <Text strong>{person?.gender || 'N/A'}</Text>
              </Descriptions.Item>
              
              <Descriptions.Item label={<span><IdcardOutlined /> Occupation Type</span>}>
                <Text strong>{person?.occupation_type || 'N/A'}</Text>
              </Descriptions.Item>
              
              <Descriptions.Item label={<span><HomeOutlined /> Residential Location</span>} span={2}>
                <Text strong>{person?.residential_location || 'N/A'}</Text>
              </Descriptions.Item>
              
              {person?.school_residential_location && (
                <Descriptions.Item label={<span><EnvironmentOutlined /> School Location</span>} span={2}>
                  <Text strong>{person.school_residential_location}</Text>
                </Descriptions.Item>
              )}
              
              <Descriptions.Item label={<span><TeamOutlined /> Group</span>} span={2}>
                <Text strong>{person?.group_name || 'N/A'}</Text>
              </Descriptions.Item>
              
              {user?.role === 'superadmin' && person?.department_name && (
                <Descriptions.Item label="Department" span={2}>
                  <Text strong>{person.department_name}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </div>
      </div>
    </>
  );
}
