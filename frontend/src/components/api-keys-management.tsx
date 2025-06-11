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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Plus, MoreHorizontal, RefreshCw, Edit, Trash2, Shield, Eye } from "lucide-react"
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isViewIpsDialogOpen, setIsViewIpsDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [rotatedKeyData, setRotatedKeyData] = useState<{id: number, system_id: string, api_key: string} | null>(null)
  
  // Form states
  const [formData, setFormData] = useState<ApiKeyCreate>(initialFormData)
  const [editFormData, setEditFormData] = useState<Partial<ApiKey>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Date formatting utility
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  }

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
      // Store the rotated key data (just id, system_id, and api_key)
      setRotatedKeyData(result.data)
      setIsRotateDialogOpen(true)
      refetch()
      onApiKeyUpdate?.()
      toast.success('API key rotated successfully')
    } catch (error: any) {
      console.error('Failed to rotate API key:', error)
      toast.error(error.error || 'Failed to rotate API key')
    }
  }

  // Handle API key editing
  const handleEdit = async () => {
    try {
      setIsSubmitting(true)
      setFormErrors({})

      if (!selectedKey || !editFormData.name) {
        setFormErrors({
          name: !editFormData.name ? "Name is required" : ""
        })
        return
      }

      await apiKeysService.update(selectedKey.id, editFormData)
      setIsEditDialogOpen(false)
      refetch()
      onApiKeyUpdate?.()
      toast.success('API key updated successfully')
    } catch (error: any) {
      console.error('Failed to update API key:', error)
      toast.error(error.error || 'Failed to update API key')
    } finally {
      setIsSubmitting(false)
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

  // Open edit dialog with current key data
  const openEditDialog = (key: ApiKey) => {
    setSelectedKey(key)
    setEditFormData({
      name: key.name,
      is_active: key.is_active,
      rate_limit: key.rate_limit,
      ip_whitelist: key.ip_whitelist,
      expires_at: key.expires_at,
      metadata: key.metadata
    })
    setIsEditDialogOpen(true)
  }

  // Open view IPs dialog
  const openViewIpsDialog = (key: ApiKey) => {
    setSelectedKey(key)
    setIsViewIpsDialogOpen(true)
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
                <TableHead>IP Addresses</TableHead>
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
                    <Badge variant={key.is_active ? "default" : "destructive"}>
                      {key.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{key.rate_limit}/15min</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {key.ip_whitelist?.length || 0} address{(key.ip_whitelist?.length || 0) !== 1 ? 'es' : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openViewIpsDialog(key)}
                        className="h-6 px-2"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(key.last_used_at)}</TableCell>
                  <TableCell>{formatDate(key.expires_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(key)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
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
              />
              {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <Label>System ID</Label>
              <Input
                value={formData.system_id}
                onChange={(e) => setFormData({ ...formData, system_id: e.target.value })}
              />
              {formErrors.system_id && <p className="text-sm text-red-500 mt-1">{formErrors.system_id}</p>}
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
              Please copy this API key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 rounded-md">
              <code className="text-sm">{rotatedKeyData?.api_key}</code>
            </div>
            <Button onClick={() => setIsRotateDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>
              Update the API key settings. The key itself cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editFormData.name || ""}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
              {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select 
                value={editFormData.is_active ? "active" : "inactive"} 
                onValueChange={(value) => setEditFormData({ ...editFormData, is_active: value === "active" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rate Limit (requests per 15 minutes)</Label>
              <Input
                type="number"
                value={editFormData.rate_limit || 1000}
                onChange={(e) => setEditFormData({ ...editFormData, rate_limit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>IP Whitelist (comma-separated)</Label>
              <Input
                value={editFormData.ip_whitelist?.join(", ") || ""}
                onChange={(e) => setEditFormData({ 
                  ...editFormData, 
                  ip_whitelist: e.target.value.split(",").map(ip => ip.trim()).filter(Boolean)
                })}
              />
            </div>
            <div>
              <Label>Expiration Date (optional)</Label>
              <Input
                type="datetime-local"
                value={editFormData.expires_at || ""}
                onChange={(e) => setEditFormData({ ...editFormData, expires_at: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleEdit} 
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View IP Addresses Dialog */}
      <Dialog open={isViewIpsDialogOpen} onOpenChange={setIsViewIpsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>IP Addresses</DialogTitle>
            <DialogDescription>
              Allowed IP addresses for {selectedKey?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedKey?.ip_whitelist && selectedKey.ip_whitelist.length > 0 ? (
              selectedKey.ip_whitelist.map((ip, index) => (
                <div key={index} className="p-2 bg-gray-100 rounded-md font-mono text-sm">
                  {ip}
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-sm">No IP restrictions (allows all addresses)</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsViewIpsDialogOpen(false)} className="flex-1">
              Close
            </Button>
            <Button onClick={() => {
              setIsViewIpsDialogOpen(false)
              if (selectedKey) openEditDialog(selectedKey)
            }} className="flex-1">
              Edit
            </Button>
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