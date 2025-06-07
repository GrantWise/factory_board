// API Key Types
export interface ApiKey {
  id: number
  name: string
  system_id: string
  is_active: boolean
  rate_limit: number
  ip_whitelist: string[]
  created_at: string
  last_used_at: string
  expires_at: string | null
  created_by: number
  metadata: Record<string, any>
}

export interface ApiKeyCreate {
  name: string
  system_id: string
  rate_limit?: number
  ip_whitelist?: string[]
  expires_at?: string
  metadata?: Record<string, any>
}

export interface ApiKeyUpdate {
  name?: string
  is_active?: boolean
  rate_limit?: number
  ip_whitelist?: string[]
  expires_at?: string
  metadata?: Record<string, any>
}

export interface ApiKeyUsage {
  id: number
  system_id: string
  total_requests: number
  success_rate: number
  avg_response_time: number
  rate_limit_hits: number
  request_volume: {
    timestamp: string
    count: number
  }[]
  response_times: {
    range: string
    count: number
  }[]
  last_used_at: string
  is_active: boolean
  expires_at: string | null
  rate_limit: number
}

// API Response interfaces
export interface ApiKeysResponse {
  message: string
  data: ApiKey[]
}

export interface ApiKeyResponse {
  message: string
  data: ApiKey
}

export interface ApiKeyCreateResponse {
  message: string
  data: ApiKey & {
    api_key: string // Only returned once on creation
  }
}

export interface ApiKeyRotateResponse {
  message: string
  data: {
    id: number
    system_id: string
    api_key: string // Only returned once on rotation
  }
}

export interface ApiKeyUsageResponse {
  message: string
  data: ApiKeyUsage
} 