"use client"

/**
 * ApiKeysAnalytics - API key usage analytics dashboard
 * 
 * Provides comprehensive analytics and monitoring for API key usage,
 * including request volumes, response times, and rate limit hits.
 * 
 * Features:
 * - Real-time usage statistics
 * - Request volume visualization
 * - Response time analysis
 * - Rate limit monitoring
 * - Time-based filtering
 * - Per-key analytics
 * 
 * Security:
 * - Admin-only access required
 * - Role-based permission checks
 */

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiData } from "@/hooks/use-api-data"
import { apiKeysService } from "@/lib/api-services"
import { useAuth } from "@/contexts/auth-context"
import { Shield } from "lucide-react"
import type { ApiKey, ApiKeyUsage } from "@/types/api-keys"
import { LineChart } from '@/components/charts/line-chart'
import { BarChart } from '@/components/charts/bar-chart'
import { PieChart } from '@/components/charts/pie-chart'
import { chartColors } from '@/lib/chart-theme'

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

export function ApiKeysAnalytics() {
  const { user, hasRole } = useAuth()
  const [selectedKey, setSelectedKey] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("24h")

  // Check if current user has admin permissions
  const isAdmin = user && hasRole("admin")

  // Fetch API keys for selector
  const { data: apiKeys, isLoading: isLoadingKeys } = useApiData<ApiKey[]>(
    () => apiKeysService.getAll(),
    [],
    { autoRefresh: 30000 }
  )

  // Fetch usage data only for specific keys (not "all")
  const { data: usageData, isLoading: isLoadingUsage } = useApiData<ApiKeyUsage>(
    selectedKey !== "all" ? () => apiKeysService.getUsage(selectedKey, timeRange) : () => Promise.resolve({} as ApiKeyUsage),
    [selectedKey, timeRange],
    { autoRefresh: 60000 }
  )

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Administrator Access Required</h3>
          <p className="text-gray-600">You need administrator permissions to view API key analytics.</p>
        </div>
      </div>
    )
  }

  if (isLoadingKeys || isLoadingUsage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  const requestVolumeData = usageData?.request_volume.map(point => ({
    name: new Date(point.timestamp).toLocaleTimeString(),
    requests: point.count,
  })) || []

  const responseTimeData = usageData?.response_times.map(point => ({
    name: point.range,
    count: point.count,
  })) || []

  const successRateData = [
    { name: 'Success', value: usageData?.success_rate || 0 },
    { name: 'Error', value: 100 - (usageData?.success_rate || 0) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Key Analytics</h2>
          <p className="text-gray-600">Monitor API key usage and performance</p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select API Key" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Keys</SelectItem>
              {apiKeys?.map((key) => (
                <SelectItem key={key.id} value={key.id.toString()}>
                  {key.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Time Range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conditional content based on selected key */}
      {selectedKey === "all" ? (
        <Card>
          <CardHeader>
            <CardTitle>API Key Overview</CardTitle>
            <CardDescription>Select a specific API key to view detailed analytics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select an API Key</h3>
              <p className="text-gray-600">Choose a specific API key from the dropdown above to view detailed usage analytics and performance metrics.</p>
            </div>
            {apiKeys && apiKeys.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Available API Keys</h4>
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{key.name}</div>
                        <div className="text-sm text-gray-600">{key.name} API Key</div>
                      </div>
                      <div className="text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageData?.total_requests.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageData?.success_rate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageData?.avg_response_time.toFixed(0)}ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Hits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageData?.rate_limit_hits.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Request Volume</CardTitle>
            <CardDescription>Number of requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={requestVolumeData}
              dataKeys={['requests']}
              height={300}
              yAxisLabel="Requests"
              xAxisLabel="Time"
              tooltipFormatter={(value) => `${value.toLocaleString()} requests`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Response Time Distribution</CardTitle>
            <CardDescription>Distribution of response times</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={responseTimeData}
              dataKeys={['count']}
              height={300}
              yAxisLabel="Count"
              xAxisLabel="Response Time (ms)"
              tooltipFormatter={(value) => `${value.toLocaleString()} requests`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Success Rate Distribution</CardTitle>
          <CardDescription>Distribution of successful vs failed requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <PieChart
              data={successRateData}
              height={300}
              tooltipFormatter={(value) => `${value.toFixed(1)}%`}
              colors={[chartColors.success.light, chartColors.error.light]}
            />
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
} 