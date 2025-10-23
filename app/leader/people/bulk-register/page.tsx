'use client';

import { useState, useEffect } from 'react';
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
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppBreadcrumb from '@/components/AppBreadcrumb';
import {
  generateBulkRegistrationTemplate,
  parseExcelFile,
  validateMemberData,
} from '@/lib/excel-utils';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface MemberData {
  full_name: string;
  phone_number: string;
  gender?: string;
  group_name: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function BulkRegisterPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups?.map((g: any) => g.name) || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = generateBulkRegistrationTemplate(groups);
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

      const validation = validateMemberData(parsedMembers, groups);

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

    setUploading(true);
    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ people: members }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload members');
      }

      setUploadResult(result);
      setCurrentStep(2);
      message.success(
        `Successfully registered ${result.inserted} member(s)!`
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
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone_number',
      key: 'phone_number',
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender?: string) => gender || <Text type="secondary">-</Text>,
    },
    {
      title: 'Home Location',
      dataIndex: 'home_location',
      key: 'home_location',
      render: (location?: string) => location || <Text type="secondary">-</Text>,
    },
    {
      title: 'Work Location',
      dataIndex: 'work_location',
      key: 'work_location',
      render: (location?: string) => location || <Text type="secondary">-</Text>,
    },
    {
      title: 'Status',
      key: 'status',
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
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2}>
              <FileExcelOutlined /> Bulk Member Registration
            </Title>
            <Text type="secondary">
              Upload an Excel file to register multiple members at once
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
                      2. Fill in the member details (delete sample rows)
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
                  Support for .xlsx and .xls files. Maximum 500 members per
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
                message={`Ready to register ${members.length} member(s)`}
                description="Review the data below and click 'Register All Members' to proceed."
                type="success"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Table
                columns={memberColumns}
                dataSource={members}
                rowKey={(record, index) => `member-${index || 0}`}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                style={{ marginBottom: 24 }}
                scroll={{ x: 800 }}
              />

              <Space>
                <Button size="large" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleBulkUpload}
                  loading={uploading}
                >
                  Register All Members
                </Button>
              </Space>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 2 && uploadResult && (
            <div style={{ textAlign: 'center' }}>
              <CheckCircleOutlined
                style={{ fontSize: 72, color: '#52c41a', marginBottom: 24 }}
              />
              <Title level={3}>Registration Complete!</Title>

              <div style={{ marginTop: 32, marginBottom: 32 }}>
                <Card>
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Text strong style={{ fontSize: 18 }}>
                        Successfully Registered:
                      </Text>
                      <div style={{ fontSize: 32, color: '#52c41a', marginTop: 8 }}>
                        {uploadResult.inserted} member(s)
                      </div>
                    </div>

                    {uploadResult.failed > 0 && (
                      <div>
                        <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>
                          Failed:
                        </Text>
                        <div style={{ fontSize: 32, color: '#ff4d4f', marginTop: 8 }}>
                          {uploadResult.failed} member(s)
                        </div>
                        {uploadResult.failedDetails && (
                          <Alert
                            message="Some registrations failed"
                            description={
                              <ul>
                                {uploadResult.failedDetails.map(
                                  (f: any, i: number) => (
                                    <li key={i}>
                                      {f.person}: {f.error}
                                    </li>
                                  )
                                )}
                              </ul>
                            }
                            type="error"
                            style={{ marginTop: 16, textAlign: 'left' }}
                          />
                        )}
                      </div>
                    )}
                  </Space>
                </Card>
              </div>

              <Space size="large">
                <Button size="large" onClick={resetForm}>
                  Register More Members
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => router.push('/leader/people')}
                >
                  View All Members
                </Button>
              </Space>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
