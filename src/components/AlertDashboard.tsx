/**
 * Alert Dashboard Component
 * Displays and manages alerts for converts at risk
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Tag, Button, Space, Empty, Alert, Badge, Modal, Spin, message } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface ConvertAlert {
  id: string
  convertId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved'
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  convert?: {
    id: string
    firstName?: string
    lastName?: string
    riskScore?: number
  }
  alertRule?: {
    id: string
    name: string
    type: string
  }
}

interface AlertDashboardProps {
  groupId: string
  onRefresh?: () => void
}

const severityColors: Record<string, string> = {
  low: 'blue',
  medium: 'orange',
  high: 'red',
  critical: 'volcano',
}

const statusColors: Record<string, string> = {
  active: 'red',
  acknowledged: 'orange',
  resolved: 'green',
}

export function AlertDashboard({ groupId, onRefresh }: AlertDashboardProps) {
  const [alerts, setAlerts] = useState<ConvertAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [activeOnly, setActiveOnly] = useState(true)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/alerts?groupId=${groupId}&status=${activeOnly ? 'active' : ''}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.alerts || [])
      } else {
        message.error('Failed to load alerts. Please try again.')
      }
    } catch (error) {
      console.error('Error loading alerts:', error)
      message.error('Network error loading alerts.')
    } finally {
      setLoading(false)
    }
  }, [groupId, activeOnly])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Acknowledged by leader' }),
      })

      if (response.ok) {
        loadAlerts()
        onRefresh?.()
      } else {
        message.error('Failed to acknowledge alert.')
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      message.error('Network error. Please try again.')
    }
  }

  const handleResolve = async (alertId: string) => {
    Modal.confirm({
      title: 'Resolve Alert',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to mark this alert as resolved?',
      okText: 'Resolve',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await fetch(`/api/alerts/${alertId}/resolve`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Resolved by leader' }),
          })

          if (response.ok) {
            loadAlerts()
            onRefresh?.()
          } else {
            message.error('Failed to resolve alert.')
          }
        } catch (error) {
          console.error('Error resolving alert:', error)
          message.error('Network error. Please try again.')
        }
      },
    })
  }

  const columns = [
    {
      title: 'Convert',
      dataIndex: ['convert', 'firstName'],
      key: 'convert',
      render: (_: any, record: ConvertAlert) => (
        <div>
          <div className="font-semibold">
            {record.convert?.firstName} {record.convert?.lastName}
          </div>
          <div className="text-xs text-gray-500">
            Risk Score:{' '}
            <Badge
              count={record.convert?.riskScore || 0}
              style={{
                backgroundColor:
                  (record.convert?.riskScore || 0) > 75
                    ? '#ff4d4f'
                    : (record.convert?.riskScore || 0) > 50
                      ? '#faad14'
                      : '#1890ff',
              }}
            />
          </div>
        </div>
      ),
      width: 200,
    },
    {
      title: 'Alert Type',
      dataIndex: ['alertRule', 'name'],
      key: 'type',
      render: (_: any, record: ConvertAlert) => (
        <div>
          <div>{record.alertRule?.name}</div>
          <div className="text-xs text-gray-500">{record.alertRule?.type}</div>
        </div>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Tag color={severityColors[severity]} icon={<WarningOutlined />}>
          {severity.toUpperCase()}
        </Tag>
      ),
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ConvertAlert) => (
        <div>
          <Tag color={statusColors[status]}>{status.toUpperCase()}</Tag>
          {status === 'acknowledged' && record.acknowledgedAt && (
            <div className="text-xs text-gray-500">
              {dayjs(record.acknowledgedAt).fromNow()}
            </div>
          )}
          {status === 'resolved' && record.resolvedAt && (
            <div className="text-xs text-gray-500">
              {dayjs(record.resolvedAt).fromNow()}
            </div>
          )}
        </div>
      ),
      width: 150,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).fromNow(),
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ConvertAlert) => (
        <Space size="small">
          {record.status === 'active' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleAcknowledge(record.id)}
              icon={<CheckOutlined />}
            >
              Acknowledge
            </Button>
          )}
          {record.status !== 'resolved' && (
            <Button
              danger
              size="small"
              onClick={() => handleResolve(record.id)}
              icon={<CloseOutlined />}
            >
              Resolve
            </Button>
          )}
        </Space>
      ),
      width: 200,
    },
  ]

  return (
    <Card
      title="Alerts & Risk Management"
      extra={
        <Space>
          <Button onClick={() => loadAlerts()} loading={loading}>
            Refresh
          </Button>
          <Button
            type={activeOnly ? 'primary' : 'default'}
            onClick={() => setActiveOnly(!activeOnly)}
          >
            {activeOnly ? 'All' : 'Active Only'}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {alerts.length === 0 ? (
          <Empty
            description={activeOnly ? 'No active alerts' : 'No alerts'}
            style={{ marginTop: '50px' }}
          />
        ) : (
          <div className="space-y-4">
            <Alert
              message={`${alerts.filter((a) => a.status === 'active').length} Active Alerts`}
              description={`${alerts.length} total alerts for this group`}
              type="warning"
              showIcon
            />
            <Table<ConvertAlert>
              columns={columns as any}
              dataSource={alerts}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} alerts`,
              }}
              size="small"
            />
          </div>
        )}
      </Spin>
    </Card>
  )
}
