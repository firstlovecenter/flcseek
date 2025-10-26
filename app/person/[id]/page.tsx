'use client';

import { useEffect, useState } from 'react';
import {
  Typography,
  Spin,
  message,
  Card,
  Button,
  Space,
  theme,
} from 'antd';
import {
  HomeOutlined,
  EnvironmentOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  TeamOutlined,
  IdcardOutlined,
  BarChartOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import { useTheme } from '@/components/AppConfigProvider';

const { Title, Text } = Typography;
const { useToken } = theme;

export default function PersonDetailPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const { token: antdToken } = useToken();

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
  
  // Check if user is a leader (read-only access)
  const isLeader = user?.role === 'leader';

  return (
    <>
      <AppBreadcrumb />
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={2} style={{ margin: 0 }}>
              {person?.first_name} {person?.last_name}
            </Title>
            <Space>
              <Button
                icon={<HomeOutlined />}
                onClick={() => router.push(backUrl)}
              >
                Home
              </Button>
              <Button
                icon={<BarChartOutlined />}
                onClick={() => router.push('/sheep-seeker/progress')}
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
            </Space>
          </div>
        </div>
        
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Card 
            style={{ 
              borderRadius: 12,
              boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              background: antdToken.colorBgContainer,
            }}
          >
            {/* Header Section */}
            <div 
              style={{ 
                background: isDark 
                  ? 'linear-gradient(135deg, #1677ff 0%, #1890ff 100%)'
                  : 'linear-gradient(135deg, #003366 0%, #004080 100%)',
                padding: '32px',
                marginBottom: 24,
                borderRadius: '12px 12px 0 0',
                marginTop: -24,
                marginLeft: -24,
                marginRight: -24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div 
                  style={{ 
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: antdToken.colorBgContainer,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 36,
                    fontWeight: 'bold',
                    color: isDark ? antdToken.colorPrimary : '#003366',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  {person?.first_name?.charAt(0)}{person?.last_name?.charAt(0)}
                </div>
                <div>
                  <Title level={2} style={{ margin: 0, color: 'white', marginBottom: 4 }}>
                    {person?.first_name} {person?.last_name}
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 16 }}>
                    <TeamOutlined /> {person?.group_name}
                  </Text>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div style={{ marginBottom: 24 }}>
              <Title level={4} style={{ marginBottom: 16, color: antdToken.colorPrimary }}>
                <PhoneOutlined /> Contact Information
              </Title>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                <div 
                  style={{ 
                    padding: 16,
                    background: antdToken.colorInfoBg,
                    borderRadius: 8,
                    border: `1px solid ${antdToken.colorInfoBorder}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </Text>
                  <a 
                    href={`tel:${person?.phone_number}`} 
                    style={{ 
                      color: antdToken.colorPrimary, 
                      fontSize: 16, 
                      fontWeight: 600,
                      textDecoration: 'none' 
                    }}
                  >
                    <PhoneOutlined /> {person?.phone_number}
                  </a>
                </div>
                
                <div 
                  style={{ 
                    padding: 16,
                    background: antdToken.colorInfoBg,
                    borderRadius: 8,
                    border: `1px solid ${antdToken.colorInfoBorder}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Date of Birth
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>
                    <CalendarOutlined /> {person?.date_of_birth || 'N/A'}
                  </Text>
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div style={{ marginBottom: 24 }}>
              <Title level={4} style={{ marginBottom: 16, color: antdToken.colorPrimary }}>
                <UserOutlined /> Personal Details
              </Title>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                <div 
                  style={{ 
                    padding: 16,
                    background: antdToken.colorSuccessBg,
                    borderRadius: 8,
                    border: `1px solid ${antdToken.colorSuccessBorder}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Gender
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>
                    {person?.gender || 'N/A'}
                  </Text>
                </div>
                
                <div 
                  style={{ 
                    padding: 16,
                    background: antdToken.colorSuccessBg,
                    borderRadius: 8,
                    border: `1px solid ${antdToken.colorSuccessBorder}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Occupation Type
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>
                    <IdcardOutlined /> {person?.occupation_type || 'N/A'}
                  </Text>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div style={{ marginBottom: 8 }}>
              <Title level={4} style={{ marginBottom: 16, color: antdToken.colorPrimary }}>
                <EnvironmentOutlined /> Location Information
              </Title>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                <div 
                  style={{ 
                    padding: 16,
                    background: antdToken.colorWarningBg,
                    borderRadius: 8,
                    border: `1px solid ${antdToken.colorWarningBorder}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <HomeOutlined /> Residential Location
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>
                    {person?.residential_location || 'N/A'}
                  </Text>
                </div>
                
                {person?.school_residential_location && (
                  <div 
                    style={{ 
                      padding: 16,
                      background: antdToken.colorWarningBg,
                      borderRadius: 8,
                      border: `1px solid ${antdToken.colorWarningBorder}`
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      <EnvironmentOutlined /> School Location
                    </Text>
                    <Text strong style={{ fontSize: 16 }}>
                      {person.school_residential_location}
                    </Text>
                  </div>
                )}
              </div>
            </div>

            {/* Department for Superadmin */}
            {user?.role === 'superadmin' && person?.department_name && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: `2px solid ${antdToken.colorBorderSecondary}` }}>
                <Title level={4} style={{ marginBottom: 16, color: antdToken.colorPrimary }}>
                  <TeamOutlined /> Administrative Information
                </Title>
                <div 
                  style={{ 
                    padding: 16,
                    background: antdToken.colorErrorBg,
                    borderRadius: 8,
                    border: `1px solid ${antdToken.colorErrorBorder}`
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Department
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>
                    {person.department_name}
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
