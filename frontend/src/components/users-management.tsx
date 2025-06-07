"use client"

/**
 * UsersManagement - Administrative interface for user management
 * 
 * Provides comprehensive user administration capabilities including user creation,
 * role management, and account status control. Includes filtering and search
 * functionality for large user bases.
 * 
 * Features:
 * - User listing with search and role filtering
 * - Create new users with role assignment
 * - Edit user details and permissions
 * - Role management (admin, manager, operator, viewer)
 * - Account activation/deactivation
 * - Password reset functionality
 * 
 * Security:
 * - Admin-only access required
 * - Role-based permission checks
 * - Audit logging for user changes
 */

import React, { useState, useEffect } from "react"
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
import { Search, Plus, MoreHorizontal, UserCheck, UserX, Edit, Trash2, Shield } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { usersService } from "@/lib/api-services"
import { getErrorMessage, getSuccessMessage, shouldLogError } from "@/lib/error-handling"
import { toast } from "sonner"
import type { User } from "@/types/manufacturing"

interface UsersManagementProps {
  /** Callback when users data needs to be refreshed */
  onUserUpdate?: () => Promise<void>
}

// User form data interface
interface UserFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  role: string
  first_name: string
  last_name: string
  is_active: boolean
}

const initialFormData: UserFormData = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'viewer',
  first_name: '',
  last_name: '',
  is_active: true
}

// Role definitions with permissions and styling
const ROLES = {
  admin: {
    name: 'Administrator',
    description: 'Full system access and user management',
    color: 'bg-red-100 text-red-800',
    permissions: ['all']
  },
  manager: {
    name: 'Manager',
    description: 'Order and work centre management',
    color: 'bg-blue-100 text-blue-800',
    permissions: ['orders:write', 'work_centres:write', 'orders:read', 'work_centres:read']
  },
  operator: {
    name: 'Operator',
    description: 'Order updates and progress tracking',
    color: 'bg-green-100 text-green-800',
    permissions: ['orders:write', 'orders:read', 'work_centres:read']
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to orders and work centres',
    color: 'bg-gray-100 text-gray-800',
    permissions: ['orders:read', 'work_centres:read']
  }
} as const

export function UsersManagement({ onUserUpdate }: UsersManagementProps) {
  const { user, hasPermission } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // Form states
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if current user has admin permissions
  const isAdmin = user && hasPermission('users:write')

  // Fetch users data
  const fetchUsers = async () => {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await usersService.getAll()
      setUsers(response.users)
    } catch (error: any) {
      if (shouldLogError(error)) {
        console.error('Failed to fetch users:', error)
      }
      const errorMessage = getErrorMessage(error, { operation: 'fetch', entity: 'users' })
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [isAdmin])

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.first_name && user.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && user.is_active) ||
      (statusFilter === "inactive" && !user.is_active)

    return matchesSearch && matchesRole && matchesStatus
  })

  // Validate form data
  const validateForm = (data: UserFormData, isEdit: boolean = false): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!data.username.trim()) {
      errors.username = 'Username is required'
    } else if (data.username.length < 3) {
      errors.username = 'Username must be at least 3 characters'
    }

    if (!data.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!isEdit) {
      if (!data.password) {
        errors.password = 'Password is required'
      } else if (data.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }

      if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    if (!data.role) {
      errors.role = 'Role is required'
    }

    return errors
  }

  // Handle create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors = validateForm(formData)
    setFormErrors(errors)
    
    if (Object.keys(errors).length > 0) return

    try {
      setIsSubmitting(true)
      
      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        first_name: formData.first_name.trim() || undefined,
        last_name: formData.last_name.trim() || undefined,
      }

      await usersService.create(userData)
      
      toast.success(getSuccessMessage({ 
        operation: 'create_user', 
        entity: 'user',
        id: userData.username 
      }))
      
      setIsCreateDialogOpen(false)
      setFormData(initialFormData)
      setFormErrors({})
      await fetchUsers()
      
      if (onUserUpdate) {
        await onUserUpdate()
      }
    } catch (error: any) {
      if (shouldLogError(error)) {
        console.error('Failed to create user:', error)
      }
      toast.error(getErrorMessage(error, { 
        operation: 'create_user', 
        entity: 'user' 
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle edit user
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    
    const errors = validateForm(formData, true)
    setFormErrors(errors)
    
    if (Object.keys(errors).length > 0) return

    try {
      setIsSubmitting(true)
      
      const updates = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        role: formData.role,
        first_name: formData.first_name.trim() || undefined,
        last_name: formData.last_name.trim() || undefined,
        is_active: formData.is_active,
      }

      await usersService.update(selectedUser.id, updates)
      
      toast.success(getSuccessMessage({ 
        operation: 'update_user', 
        entity: 'user' 
      }))
      
      setIsEditDialogOpen(false)
      setSelectedUser(null)
      setFormData(initialFormData)
      setFormErrors({})
      await fetchUsers()
      
      if (onUserUpdate) {
        await onUserUpdate()
      }
    } catch (error: any) {
      if (shouldLogError(error)) {
        console.error('Failed to update user:', error)
      }
      toast.error(getErrorMessage(error, { 
        operation: 'update_user', 
        entity: 'user' 
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      setIsSubmitting(true)
      
      await usersService.delete(selectedUser.id)
      
      toast.success(getSuccessMessage({ 
        operation: 'delete_user', 
        entity: 'user' 
      }))
      
      setIsDeleteDialogOpen(false)
      setSelectedUser(null)
      await fetchUsers()
      
      if (onUserUpdate) {
        await onUserUpdate()
      }
    } catch (error: any) {
      if (shouldLogError(error)) {
        console.error('Failed to delete user:', error)
      }
      toast.error(getErrorMessage(error, { operation: 'delete_user', entity: 'user' }))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle toggle user status
  const handleToggleUserStatus = async (targetUser: User) => {
    try {
      await usersService.toggleActive(targetUser.id)
      
      const action = targetUser.is_active ? 'deactivated' : 'activated'
      toast.success(`User ${action} successfully`)
      
      await fetchUsers()
      
      if (onUserUpdate) {
        await onUserUpdate()
      }
    } catch (error: any) {
      if (shouldLogError(error)) {
        console.error('Failed to toggle user status:', error)
      }
      toast.error(getErrorMessage(error, { operation: 'update_user', entity: 'user' }))
    }
  }

  // Open edit dialog with user data
  const openEditDialog = (targetUser: User) => {
    setSelectedUser(targetUser)
    setFormData({
      username: targetUser.username,
      email: targetUser.email,
      password: '',
      confirmPassword: '',
      role: targetUser.role,
      first_name: targetUser.first_name || '',
      last_name: targetUser.last_name || '',
      is_active: targetUser.is_active,
    })
    setFormErrors({})
    setIsEditDialogOpen(true)
  }

  // Open delete dialog
  const openDeleteDialog = (targetUser: User) => {
    setSelectedUser(targetUser)
    setIsDeleteDialogOpen(true)
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Administrator Access Required</h3>
          <p className="text-gray-600">You need administrator permissions to manage users.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary-blue">User Management</h2>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account with a specific role and permissions. All users will receive login credentials via email.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="johndoe"
                  required
                />
                {formErrors.username && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.username}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                  required
                />
                {formErrors.email && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="role">Role *</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([key, role]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium">{role.name}</div>
                          <div className="text-xs text-gray-500">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.role && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.role}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                  {formErrors.password && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.password}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                  {formErrors.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    setFormData(initialFormData)
                    setFormErrors({})
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{users.filter(u => u.is_active).length}</div>
            <div className="text-sm text-gray-600">Active Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-sm text-gray-600">Administrators</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'operator').length}</div>
            <div className="text-sm text-gray-600">Operators</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(ROLES).map(([key, role]) => (
              <SelectItem key={key} value={key}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((targetUser) => (
                <TableRow key={targetUser.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{targetUser.username}</div>
                      {(targetUser.first_name || targetUser.last_name) && (
                        <div className="text-sm text-gray-500">
                          {[targetUser.first_name, targetUser.last_name].filter(Boolean).join(' ')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{targetUser.email}</TableCell>
                  <TableCell>
                    <Badge className={ROLES[targetUser.role as keyof typeof ROLES]?.color || 'bg-gray-100 text-gray-800'}>
                      {ROLES[targetUser.role as keyof typeof ROLES]?.name || targetUser.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={targetUser.is_active ? "default" : "secondary"}>
                      {targetUser.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {targetUser.last_login 
                      ? new Date(targetUser.last_login).toLocaleDateString()
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(targetUser)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleUserStatus(targetUser)}>
                          {targetUser.is_active ? (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        {targetUser.id !== user?.id && (
                          <DropdownMenuItem 
                            onClick={() => openDeleteDialog(targetUser)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No users found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User - {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              Update user information, role assignments, and account status. Changes will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">First Name</Label>
                <Input
                  id="edit_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Last Name</Label>
                <Input
                  id="edit_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_username">Username *</Label>
              <Input
                id="edit_username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                required
              />
              {formErrors.username && (
                <p className="text-sm text-red-600 mt-1">{formErrors.username}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
              {formErrors.email && (
                <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit_role">Role *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, role]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-xs text-gray-500">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit_is_active">Account is active</Label>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setSelectedUser(null)
                  setFormData(initialFormData)
                  setFormErrors({})
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user &quot;{selectedUser?.username}&quot;? 
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}