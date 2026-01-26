/**
 * Milestone Progress Component
 * Displays and manages milestone progression for a convert
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, Progress, Tag, Button, Empty, Tooltip, Space, Alert } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  AlertOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface Milestone {
  id: string
  stageNumber: number
  stageName?: string
  shortName?: string
  description?: string
  isAutoCalculated?: boolean
}

interface ProgressRecord {
  id: string
  stageNumber: number
  stageName: string
  isCompleted: boolean
  dateCompleted?: string
}

interface MilestoneProgressProps {
  convertId: string
  progressRecords: ProgressRecord[]
  milestones: Milestone[]
  onMilestoneUpdate?: () => void
}

export function MilestoneProgress({
  convertId,
  progressRecords,
  milestones,
  onMilestoneUpdate,
}: MilestoneProgressProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Calculate progress percentage
  const completedCount = progressRecords.filter((p) => p.isCompleted).length
  const totalMilestones = milestones.length
  const progressPercent = Math.round((completedCount / totalMilestones) * 100)

  // Handle manual auto-update trigger
  const handleAutoUpdate = async () => {
    setIsUpdating(true)
    setUpdateError(null)

    try {
      const response = await fetch('/api/milestones/auto-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'current-user-id', // Replace with actual user ID from context
        },
        body: JSON.stringify({ convertId }),
      })

      if (!response.ok) {
        const error = await response.json()
        setUpdateError(error.error || 'Failed to update milestones')
      } else {
        const data = await response.json()
        if (data.totalNewMilestones > 0) {
          onMilestoneUpdate?.()
        }
      }
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <Card>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Milestone Progress</h3>
            <span className="text-2xl font-bold text-blue-600">
              {completedCount}/{totalMilestones}
            </span>
          </div>

          <Progress
            percent={progressPercent}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            status={progressPercent === 100 ? 'success' : 'active'}
          />

          <div className="flex gap-2 justify-between text-sm text-gray-500">
            <span>{completedCount} completed</span>
            <span>{totalMilestones - completedCount} remaining</span>
          </div>

          {updateError && <Alert message={updateError} type="error" showIcon closable />}

          <Button
            type="primary"
            size="small"
            onClick={handleAutoUpdate}
            loading={isUpdating}
            icon={<RobotOutlined />}
          >
            Check Auto-Milestones
          </Button>
        </div>
      </Card>

      {/* Milestone List */}
      {totalMilestones > 0 ? (
        <Card title="Detailed Milestones" size="small">
          <div className="space-y-2">
            {milestones.map((milestone) => {
              const progress = progressRecords.find((p) => p.stageNumber === milestone.stageNumber)
              const isCompleted = progress?.isCompleted || false
              const completionDate = progress?.dateCompleted

              return (
                <div
                  key={milestone.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <Tooltip title={`Completed ${dayjs(completionDate).format('MMM DD, YYYY')}`}>
                        <CheckCircleOutlined className="text-green-600 text-xl" />
                      </Tooltip>
                    ) : (
                      <ClockCircleOutlined className="text-gray-400 text-xl" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {milestone.stageNumber}. {milestone.stageName || `Milestone ${milestone.stageNumber}`}
                      </span>

                      {milestone.isAutoCalculated && (
                        <Tag
                          icon={<RobotOutlined />}
                          color="blue"
                          style={{ fontSize: '0.75rem' }}
                        >
                          Auto
                        </Tag>
                      )}

                      {isCompleted && (
                        <Tag color="green" style={{ fontSize: '0.75rem' }}>
                          Complete
                        </Tag>
                      )}
                    </div>

                    {milestone.description && (
                      <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                    )}

                    {completionDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Completed {dayjs(completionDate).fromNow()}
                      </p>
                    )}
                  </div>

                  {/* Stage Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {milestone.stageNumber}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        <Empty description="No milestones found" />
      )}

      {/* Auto-Calculate Info */}
      {milestones.some((m) => m.isAutoCalculated) && (
        <Alert
          message="Auto-Milestone Feature Enabled"
          description="Some milestones have automatic completion enabled based on attendance and time criteria. Use the 'Check Auto-Milestones' button to evaluate eligibility."
          type="info"
          showIcon
          icon={<RobotOutlined />}
        />
      )}
    </div>
  )
}
