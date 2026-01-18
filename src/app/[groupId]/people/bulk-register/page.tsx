'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Card,
  Button,
  Upload,
  Typography,
  Steps,
  Table,
  message,
  Alert,
  Space,
  Tag,
  Modal,
  Spin,
  Select,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  HomeOutlined,
  BarChartOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import {
  generateBulkRegistrationTemplate,
  parseExcelFile,
  validateMemberData,
} from '@/lib/excel-utils';
import { api } from '@/lib/api';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface MemberData {
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  residential_location: string;
  school_residential_location?: string;
  occupation_type: string;
  group_id?: string;
  group_name?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

function BulkRegisterContent() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groupId);

  useEffect(() => {
    // Check group access: superadmin/leadpastor can view any; admin/leader limited to their group
    if (user && user.role !== 'superadmin' && user.role !== 'leadpastor' && user.role !== 'overseer' && user.group_id !== groupId) {
      router.push('/');
      return;
    }

    fetchGroups();
  }, [user, groupId, router]);

  useEffect(() => {
    // Set default group if provided in URL
    if (groupId) {
      setSelectedGroupId(groupId);
    }
  }, [groupId]);

  const fetchGroups = async () => {
    try {
      const response = await api.groups.list();
      if (response.success) {
        setGroups(response.data?.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = generateBulkRegistrationTemplate(groups.map(g => g.name));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_registration_template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Template downloaded successfully!');
  };

  const handleFileUpload = async (file: File) => {
    setFile(file);
    setErrors([]);

    try {
      const parsedMembers = await parseExcelFile(file);

      if (parsedMembers.length === 0) {
        message.error('No data found in the file');
        return false;
      }

      if (parsedMembers.length > 500) {
        message.error('Maximum 500 members allowed per upload');
        return false;
      }

      const validation = validateMemberData(parsedMembers, groups.map(g => g.name));

      if (!validation.isValid) {
        setErrors(validation.errors);
        message.warning(
          `Found ${validation.errors.length} validation error(s). Please review and fix.`
        );
      } else {
        message.success(
          `File validated successfully! ${parsedMembers.length} members ready to upload.`
        );
        setCurrentStep(1);
      }

      setMembers(parsedMembers);
      return false; // Prevent default upload
    } catch (error: any) {
      message.error('Error parsing file: ' + error.message);
      return false;
    }
  };

  const handleBulkUpload = async () => {
    if (errors.length > 0) {
      message.error('Please fix all validation errors before uploading');
      return;
    }

    // Use the groupId from the URL path
    const targetGroupId = groupId;
    
    if (!targetGroupId && !user?.group_name) {
      message.error('Please select a group or your account does not have a group assigned.');
      return;
    }

    // Get the group name for the selected group
    const selectedGroup = groups.find(g => g.id === targetGroupId);
    const targetGroupName = selectedGroup?.name || user?.group_name;

    if (!targetGroupName) {
      message.error('Unable to determine group name. Please select a valid group.');
      return;
    }

    setUploading(true);
    try {
      // Add the target group to all members
      const membersWithGroup = members.map(member => ({
        ...member,
        group_id: targetGroupId || user?.group_id,
        group_name: targetGroupName,
      }));

      const response = await api.people.bulkCreate(membersWithGroup);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to upload members');
      }

      setUploadResult(response.data);
      setCurrentStep(2);
      message.success(
        `Successfully registered ${response.data?.inserted || 0} member(s)!`
      );
    } catch (error: any) {
      message.error(error.message || 'Failed to upload members');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setFile(null);
    setMembers([]);
    setErrors([]);
    setUploadResult(null);
  };

  const memberColumns = [
    {
      title: 'Row',
      key: 'row',
      render: (_: any, __: any, index: number) => index + 2,
      width: 60,
    },
    {
      title: 'Name',
      key: 'name',
      render: (record: MemberData) => `${record.first_name} ${record.last_name}`,
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
      width: 130,
    },
    {
      title: 'DOB',
      dataIndex: 'date_of_birth',
      key: 'date_of_birth',
      width: 80,
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
    },
    {
      title: 'Location',
      dataIndex: 'residential_location',
      key: 'residential_location',
      ellipsis: true,
    },
    {
      title: 'Worker/Student',
      dataIndex: 'occupation_type',
      key: 'occupation_type',
      width: 100,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: any, __: any, index: number) => {
        const rowErrors = errors.filter((e) => e.row === index + 2);
        if (rowErrors.length > 0) {
          return (
            <Tag color="error" icon={<ExclamationCircleOutlined />}>
              {rowErrors.length} Error(s)
            </Tag>
          );
        }
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Valid
          </Tag>
        );
      },
    },
  ];

  const errorColumns = [
    {
      title: 'Row',
      dataIndex: 'row',
      key: 'row',
      width: 80,
    },
    {
      title: 'Field',
      dataIndex: 'field',
      key: 'field',
      width: 150,
    },
    {
      title: 'Error Message',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  const steps = [
    {
      title: 'Upload File',
      icon: <UploadOutlined />,
    },
    {
      title: 'Review Data',
      icon: <CheckCircleOutlined />,
    },
    {
      title: 'Complete',
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <>
      <AppBreadcrumb />
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {groupId && (
          <Alert
            message={`Registering to: ${groups.find(g => g.id === groupId)?.name || 'Selected Group'}`}
            type="info"
            showIcon
            style={{ flex: 1 }}
          />
        )}
        <Space>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => {
              router.push(`/${groupId}`);
            }}
          >
            Milestones
          </Button>
          <Button
            icon={<TeamOutlined />}
            onClick={() => {
              router.push(`/${groupId}/attendance`);
            }}
          >
            Attendance
          </Button>
          <Button
            icon={<UserAddOutlined />}
            onClick={() => {
              router.push(`/${groupId}/people/register`);
            }}
          >
            Register
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            type="primary"
          >
            Bulk Register
          </Button>
        </Space>
      </div>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>
              <FileExcelOutlined /> Bulk Convert Registration
            </Title>
            <Text type="secondary">
              Upload an Excel file to register multiple converts at once
            </Text>
          </div>

          <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

          {/* Step 1: Upload File */}
          {currentStep === 0 && (
            <div>
              <Alert
                message="Before You Start"
                description={
                  <div>
                    <Paragraph>
                      1. Download the Excel template below
                    </Paragraph>
                    <Paragraph>
                      2. Fill in the convert details (delete sample rows)
                    </Paragraph>
                    <Paragraph>
                      3. Upload the completed file
                    </Paragraph>
                    <Paragraph>
                      4. Review and submit
                    </Paragraph>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                size="large"
                style={{ marginBottom: 24 }}
              >
                Download Excel Template
              </Button>

              <Dragger
                name="file"
                multiple={false}
                accept=".xlsx,.xls"
                beforeUpload={handleFileUpload}
                showUploadList={false}
                style={{ marginBottom: 24 }}
              >
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text">
                  Click or drag Excel file to this area to upload
                </p>
                <p className="ant-upload-hint">
                  Support for .xlsx and .xls files. Maximum 500 converts per
                  upload.
                </p>
              </Dragger>

              {file && (
                <Alert
                  message={`File uploaded: ${file.name}`}
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {errors.length > 0 && (
                <div>
                  <Alert
                    message={`Found ${errors.length} validation error(s)`}
                    description="Please fix the errors in your Excel file and re-upload."
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Table
                    columns={errorColumns}
                    dataSource={errors}
                    rowKey={(record) => `${record.row}-${record.field}`}
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </div>
              )}

              {members.length > 0 && errors.length === 0 && (
                <div style={{ textAlign: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => setCurrentStep(1)}
                  >
                    Continue to Review
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review Data */}
          {currentStep === 1 && (
            <div>
              <Alert
                message={`Ready to register ${members.length} convert(s)`}
                description="Review the data below and click 'Register All Converts' to proceed."
                type="success"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Table
                columns={memberColumns}
                dataSource={members}
                rowKey={(_record, index) => (index ?? 0)}
                pagination={{ pageSize: 10 }}
                size="small"
                style={{ marginBottom: 24 }}
              />

              <Space style={{ width: '100%', justifyContent: 'center' }}>
                <Button onClick={() => setCurrentStep(0)}>
                  Back
                </Button>
                <Button
                  type="primary"
                  loading={uploading}
                  onClick={handleBulkUpload}
                  size="large"
                >
                  Register All Converts
                </Button>
              </Space>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 2 && uploadResult && (
            <div>
              <Alert
                message="Bulk Registration Complete"
                description={`Successfully registered ${uploadResult.inserted} convert(s). ${uploadResult.duplicates ? uploadResult.duplicates + ' duplicate(s) were skipped.' : ''}`}
                type="success"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Space style={{ width: '100%', justifyContent: 'center' }}>
                <Button
                  type="primary"
                  onClick={() => router.push(`/${groupId}`)}
                >
                  Go to Milestones
                </Button>
                <Button onClick={resetForm}>
                  Register More Converts
                </Button>
              </Space>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export default function BulkRegisterPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}>
      <BulkRegisterContent />
    </Suspense>
  );
}
