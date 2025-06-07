"use client"

/**
 * ApiKeysManagement - Administrative interface for API key management
 * 
 * Provides comprehensive API key administration capabilities including key creation,
 * rotation, and status control. Includes filtering and search functionality.
 * 
 * Features:
 * - API key listing with search and status filtering
 * - Create new API keys with rate limits and IP whitelists
 * - Rotate existing API keys
 * - View key details and usage statistics
 * - IP whitelist management
 * - Rate limit configuration
 * - Expiration date setting
 * 
 * Security:
 * - Admin-only access required
 * - Role-based permission checks
 * - Audit logging for key changes
 */

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Search, Plus, MoreHorizontal, Key, RefreshCw, Edit, Trash2, Shield } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiKeysService } from "@/lib/api-services"
import { useApiData } from "@/hooks/use-api-data"
import { toast } from "sonner"
import type { ApiKey, ApiKeyCreate } from "@/types/api-keys"

interface ApiKeysManagementProps {
  onApiKeyUpdate?: () => void
}

const initialFormData: ApiKeyCreate = {
  name: '',
  system_id: '',
  rate_limit: 1000,
  ip_whitelist: [],
  expires_at: undefined,
  metadata: {}
}

export function ApiKeysManagement({ onApiKeyUpdate }: ApiKeysManagementProps) {
  const { user, hasRole } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  
  // Form states
  const [formData, setFormData] = useState<ApiKeyCreate>(initialFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if current user has admin permissions
  const isAdmin = user && hasRole("admin")

  // Fetch API keys data
  const { data: apiKeys, isLoading, refetch } = useApiData(
    () => apiKeysService.getAll(),
    [],
    { 
      autoRefresh: 30000,
      onError: (error) => {
        if (error.status === 401 || error.status === 429) return;
        toast.error('Failed to fetch API keys')
      }
    }
  )

  // Filter API keys based on search term and status
  const filteredApiKeys = apiKeys?.filter(key => {
    const matchesSearch = key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.system_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && key.is_active) ||
                         (statusFilter === "inactive" && !key.is_active)
    return matchesSearch && matchesStatus
  })

  // Handle API key creation
  const handleCreate = async () => {
    try {
      setIsSubmitting(true)
      setFormErrors({})

      // Validate form data
      if (!formData.name || !formData.system_id) {
        setFormErrors({
          name: !formData.name ? "Name is required" : "",
          system_id: !formData.system_id ? "System ID is required" : ""
        })
        return
      }

      const result = await apiKeysService.create(formData)
      
      // Show new API key in a secure dialog
      setSelectedKey(result.data)
      setIsCreateDialogOpen(false)
      setIsRotateDialogOpen(true)
      
      // Reset form
      setFormData(initialFormData)
      
      // Refresh data
      refetch()
      onApiKeyUpdate?.()
      
      toast.success('API key created successfully')
    } catch (error: any) {
      console.error('Failed to create API key:', error)
      toast.error(error.error || 'Failed to create API key')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle API key rotation
  const handleRotate = async (id: number) => {
    try {
      const result = await apiKeysService.rotate(id)
      setSelectedKey(result.data)
      setIsRotateDialogOpen(true)
      refetch()
      onApiKeyUpdate?.()
      toast.success('API key rotated successfully')
    } catch (error: any) {
      console.error('Failed to rotate API key:', error)
      toast.error(error.error || 'Failed to rotate API key')
    }
  }

  // Handle API key deletion
  const handleDelete = async (id: number) => {
    try {
      await apiKeysService.delete(id)
      setIsDeleteDialogOpen(false)
      refetch()
      onApiKeyUpdate?.()
      toast.success('API key deactivated successfully')
    } catch (error: any) {
      console.error('Failed to delete API key:', error)
      toast.error(error.error || 'Failed to delete API key')
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Administrator Access Required</h3>
          <p className="text-gray-600">You need administrator permissions to manage API keys.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading API keys...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Key Management</h2>
          <p className="text-gray-600">Manage API keys for external system integration</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create New API Key
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search API keys..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>System ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApiKeys?.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>{key.system_id}</TableCell>
                  <TableCell>
                    <Badge variant={key.is_active ? "success" : "destructive"}>
                      {key.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{key.rate_limit}/15min</TableCell>
                  <TableCell>
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRotate(key.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Rotate Key
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedKey(key)
                          setIsDeleteDialogOpen(true)
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external system integration. The key will be shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name}
              />
            </div>
            <div>
              <Label>System ID</Label>
              <Input
                value={formData.system_id}
                onChange={(e) => setFormData({ ...formData, system_id: e.target.value })}
                error={formErrors.system_id}
              />
            </div>
            <div>
              <Label>Rate Limit (requests per 15 minutes)</Label>
              <Input
                type="number"
                value={formData.rate_limit}
                onChange={(e) => setFormData({ ...formData, rate_limit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>IP Whitelist (comma-separated)</Label>
              <Input
                value={formData.ip_whitelist?.join(", ") || ""}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  ip_whitelist: e.target.value.split(",").map(ip => ip.trim()).filter(Boolean)
                })}
              />
            </div>
            <div>
              <Label>Expiration Date (optional)</Label>
              <Input
                type="datetime-local"
                value={formData.expires_at || ""}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>
            <Button 
              onClick={handleCreate} 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Creating..." : "Create API Key"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rotate Dialog */}
      <Dialog open={isRotateDialogOpen} onOpenChange={setIsRotateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Please copy this API key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 rounded-md">
              <code className="text-sm">{selectedKey?.api_key}</code>
            </div>
            <Button onClick={() => setIsRotateDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this API key? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedKey && handleDelete(selectedKey.id)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 