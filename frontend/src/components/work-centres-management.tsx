"use client"

/**
 * WorkCentresManagement - Complete work centre administration interface
 * 
 * Provides comprehensive management of manufacturing work centres including
 * creation, editing, deletion, and status management. Features drag-and-drop
 * reordering with automatic backend synchronization.
 * 
 * Core Features:
 * - Create new work centres with capacity and machine assignments
 * - Edit existing work centre properties (name, capacity, machines, status)
 * - Delete work centres with confirmation dialogs
 * - Toggle active/inactive status for work centres
 * - Drag-and-drop reordering with visual feedback
 * 
 * Data Management:
 * - Converts between legacy string IDs and numeric API IDs
 * - Validates input before API calls
 * - Provides detailed error handling and user feedback
 * - Triggers data refresh after modifications
 * 
 * UI/UX:
 * - Card-based layout with hover effects
 * - Visual drag indicators and feedback
 * - Status badges and action buttons
 * - Modal dialogs for create/edit operations
 */

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, GripVertical, Power, Edit } from "lucide-react"
import type { WorkCentre } from "@/types/manufacturing"
import { cn } from "@/lib/utils"
import { workCentresService } from "@/lib/api-services"
import { toast } from "sonner"

interface WorkCentresManagementProps {
  /** Work centres in API format for display */
  workCentres: WorkCentre[]
  /** Callback triggered after work centre modifications to refresh data */
  onWorkCentreUpdate?: () => void
}

/**
 * Helper functions for managing work centre data transformations
 * Maps between legacy string-based IDs and numeric API IDs
 * Required because UI uses legacy format while API expects numeric IDs
 */

export function WorkCentresManagement({ workCentres, onWorkCentreUpdate }: WorkCentresManagementProps) {
  const [centres, setCentres] = useState<WorkCentre[]>(workCentres)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCentre, setEditingCentre] = useState<WorkCentre | null>(null)
  const [draggedCentre, setDraggedCentre] = useState<number | null>(null)


  const [newCentre, setNewCentre] = useState({
    name: "",
    capacity: 5,
    machines: "",
    description: "",
    is_active: true,
  })

  /**
   * Creates a new work centre via API
   * Validates input and generates unique code before creation
   */
  const handleAddCentre = async () => {
    try {
      // Comprehensive input validation
      const trimmedName = newCentre.name.trim();
      
      if (!trimmedName) {
        toast.error('Work centre name is required')
        return
      }

      if (trimmedName.length < 2) {
        toast.error('Work centre name must be at least 2 characters long')
        return
      }

      if (trimmedName.length > 50) {
        toast.error('Work centre name must be less than 50 characters')
        return
      }

      // Validate name contains only allowed characters
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
        toast.error('Work centre name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores.')
        return
      }

      // Check for duplicate names
      if (centres.some(centre => centre.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast.error('A work centre with this name already exists')
        return
      }

      // Validate capacity
      if (newCentre.capacity < 1) {
        toast.error('Capacity must be at least 1')
        return
      }

      if (newCentre.capacity > 100) {
        toast.error('Capacity cannot exceed 100 jobs')
        return
      }

      // Validate machines input if provided
      const machinesInput = newCentre.machines.trim();
      if (machinesInput) {
        const machines = machinesInput.split(',').map(m => m.trim()).filter(m => m);
        if (machines.some(machine => !/^[a-zA-Z0-9\-_]+$/.test(machine))) {
          toast.error('Machine names contain invalid characters. Use only letters, numbers, hyphens, and underscores.')
          return
        }
      }

      const workCentreData = {
        name: trimmedName,
        code: `WC-${trimmedName.toUpperCase().slice(0, 8).replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`,
        capacity: newCentre.capacity,
        display_order: centres.length + 1,
        description: newCentre.description.trim() || undefined,
        is_active: true // Default to active for new work centres
      };

      console.log('[WorkCentre] Creating with data:', workCentreData);
      
      const response = await workCentresService.create(workCentreData);
      console.log('[WorkCentre] Create response:', response);
      
      // Add machines if provided
      if (newCentre.machines.trim()) {
        const machines = newCentre.machines.split(',').map(m => m.trim()).filter(m => m);
        for (const machineName of machines) {
          const machineCode = `MACH-${machineName.toUpperCase().slice(0, 8).replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;
          await workCentresService.addMachine(response.work_centre.id, {
            name: machineName,
            code: machineCode,
            description: `Machine for ${trimmedName}`
          });
        }
      }
      
      onWorkCentreUpdate?.() // Trigger refresh
      setIsAddDialogOpen(false)
      setNewCentre({ name: "", capacity: 5, machines: "", description: "", is_active: true })
      toast.success('Work centre created successfully')
    } catch (error: unknown) {
      console.error('[WorkCentre] Create error:', error);
      const err = error as { error?: string; message?: string; details?: any; status?: number };
      
      // Try to get a meaningful error message
      let errorMessage = err.error || err.message || 'Failed to create work centre';
      
      // If we have details, try to extract more specific error information
      if (err.details) {
        if (typeof err.details === 'string') {
          errorMessage = err.details;
        } else if (err.details.error) {
          errorMessage = err.details.error;
        } else if (err.details.message) {
          errorMessage = err.details.message;
        } else if (typeof err.details === 'object') {
          // Handle validation errors
          const validationErrors = Object.entries(err.details)
            .map(([field, message]) => `${field}: ${message}`)
            .join('\n');
          errorMessage = `Validation failed:\n${validationErrors}`;
        }
      }
      
      toast.error(errorMessage);
    }
  }

  /**
   * Initiates work centre editing by populating form with current values
   * @param centre - Work centre to edit
   */
  const handleEditCentre = (centre: WorkCentre) => {
    setEditingCentre(centre)
    setNewCentre({
      name: centre.name,
      capacity: centre.capacity,
      machines: centre.machines.map(m => m.name).join(", "),
      description: centre.description || "",
      is_active: centre.is_active,
    })
  }

  /**
   * Updates existing work centre via API
   * Validates input and maps legacy ID to numeric ID for API call
   */
  const handleUpdateCentre = async () => {
    if (!editingCentre) return

    try {
      // Comprehensive input validation
      const trimmedName = newCentre.name.trim();
      
      if (!trimmedName) {
        toast.error('Work centre name is required')
        return
      }

      if (trimmedName.length < 2) {
        toast.error('Work centre name must be at least 2 characters long')
        return
      }

      if (trimmedName.length > 50) {
        toast.error('Work centre name must be less than 50 characters')
        return
      }

      // Validate name contains only allowed characters
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
        toast.error('Work centre name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores.')
        return
      }

      // Check for duplicate names (excluding current centre)
      if (centres.some(centre => centre.id !== editingCentre.id && centre.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast.error('A work centre with this name already exists')
        return
      }

      // Validate capacity
      if (newCentre.capacity < 1) {
        toast.error('Capacity must be at least 1')
        return
      }

      if (newCentre.capacity > 100) {
        toast.error('Capacity cannot exceed 100 jobs')
        return
      }

      // Validate machines input if provided
      const machinesInput = newCentre.machines.trim();
      if (machinesInput) {
        const machines = machinesInput.split(',').map(m => m.trim()).filter(m => m);
        if (machines.some(machine => !/^[a-zA-Z0-9\-_]+$/.test(machine))) {
          toast.error('Machine names contain invalid characters. Use only letters, numbers, hyphens, and underscores.')
          return
        }
      }

      const updates = {
        name: trimmedName,
        capacity: newCentre.capacity,
        is_active: newCentre.is_active,
        description: newCentre.description.trim() || undefined
      };

      await workCentresService.update(editingCentre.id, updates);

      // Handle machines separately
      if (editingCentre) {
        // Get current machines
        const currentMachines = editingCentre.machines || [];
        const newMachines = newCentre.machines.trim() ? newCentre.machines.split(',').map(m => m.trim()).filter(m => m) : [];
        
        // Delete machines that are no longer in the list
        for (const machine of currentMachines) {
          if (!newMachines.includes(machine.name)) {
            await workCentresService.deleteMachine(editingCentre.id, machine.id);
          }
        }
        
        // Add new machines
        for (const machineName of newMachines) {
          if (!currentMachines.some(m => m.name === machineName)) {
            const machineCode = `MACH-${machineName.toUpperCase().slice(0, 8).replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;
            await workCentresService.addMachine(editingCentre.id, {
              name: machineName,
              code: machineCode,
              description: `Machine for ${trimmedName}`
            });
          }
        }
      }

      onWorkCentreUpdate?.() // Trigger refresh from API
      setEditingCentre(null)
      setNewCentre({ name: "", capacity: 5, machines: "", description: "", is_active: true })
      toast.success('Work centre updated successfully')
    } catch (error: unknown) {
      const err = error as { error?: string; message?: string; details?: any; status?: number };
      
      // Try to get a meaningful error message
      let errorMessage = err.error || err.message || 'Failed to update work centre';
      
      // If we have details, try to extract more specific error information
      if (err.details) {
        if (typeof err.details === 'string') {
          errorMessage = err.details;
        } else if (err.details.error) {
          errorMessage = err.details.error;
        } else if (err.details.message) {
          errorMessage = err.details.message;
        } else if (typeof err.details === 'object') {
          // Handle validation errors
          const validationErrors = Object.entries(err.details)
            .map(([field, message]) => `${field}: ${message}`)
            .join('\n');
          errorMessage = `Validation failed:\n${validationErrors}`;
        }
      }
      
      toast.error(errorMessage);
    }
  }

  /**
   * Deletes work centre after user confirmation
   * @param centreId - Work centre ID to delete
   */
  const handleDeleteCentre = async (centreId: number) => {
    try {
      if (!confirm('Are you sure you want to delete this work centre? This action cannot be undone.')) {
        return
      }

      await workCentresService.delete(centreId)

      onWorkCentreUpdate?.() // Trigger refresh from API
      toast.success('Work centre deleted successfully')
    } catch (error: unknown) {
      const err = error as { error?: string }
      toast.error(err.error || 'Failed to delete work centre')
    }
  }

  /**
   * Toggles work centre active/inactive status
   * @param centreId - Work centre ID to toggle
   */
  const handleToggleStatus = async (centreId: number) => {
    try {
      // Find the work centre to toggle
      const centre = centres.find(c => c.id === centreId)
      if (!centre) {
        toast.error('Work centre not found')
        return
      }

      const newIsActive = !centre.is_active
      
      const updates = {
        is_active: newIsActive,
      }

      await workCentresService.update(centreId, updates)

      onWorkCentreUpdate?.() // Trigger refresh from API
      toast.success(`Work centre ${newIsActive ? 'activated' : 'deactivated'} successfully`)
    } catch (error: unknown) {
      const err = error as { error?: string }
      toast.error(err.error || 'Failed to update work centre status')
    }
  }

  /**
   * Initiates drag operation for work centre reordering
   * @param e - Drag event
   * @param centreId - ID of work centre being dragged
   */
  const handleDragStart = (e: React.DragEvent, centreId: number) => {
    setDraggedCentre(centreId)
    e.dataTransfer.setData("text/plain", centreId.toString())
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  /**
   * Handles drop operation for work centre reordering
   * Updates order values and triggers callback for persistence
   * @param e - Drop event
   * @param targetCentreId - ID of drop target work centre
   */
  const handleDrop = (e: React.DragEvent, targetCentreId: number) => {
    e.preventDefault()
    const draggedCentreId = parseInt(e.dataTransfer.getData("text/plain"))

    if (draggedCentreId === targetCentreId) return

    const draggedIndex = centres.findIndex((c) => c.id === draggedCentreId)
    const targetIndex = centres.findIndex((c) => c.id === targetCentreId)

    const newCentres = [...centres]
    const [draggedCentre] = newCentres.splice(draggedIndex, 1)
    newCentres.splice(targetIndex, 0, draggedCentre)

    // Update display_order values
    const updatedCentres = newCentres.map((centre, index) => ({
      ...centre,
      display_order: index + 1,
    }))

    setCentres(updatedCentres)
    onWorkCentreUpdate?.()
    setDraggedCentre(null)
  }

  const sortedCentres = [...centres].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary-blue">Work Centres Management</h2>
          <p className="text-gray-600">Configure and manage your manufacturing work centres</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Work Centre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Work Centre</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Work Centre Name</Label>
                <Input
                  id="name"
                  value={newCentre.name}
                  onChange={(e) => setNewCentre({ ...newCentre, name: e.target.value })}
                  placeholder="e.g., Cutting, Assembly"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity (Max Jobs)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={newCentre.capacity}
                  onChange={(e) => setNewCentre({ ...newCentre, capacity: Number.parseInt(e.target.value) || 5 })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newCentre.description}
                  onChange={(e) => setNewCentre({ ...newCentre, description: e.target.value })}
                  placeholder="Enter work centre description"
                />
              </div>
              <div>
                <Label htmlFor="machines">Machines (comma-separated)</Label>
                <Input
                  id="machines"
                  value={newCentre.machines}
                  onChange={(e) => setNewCentre({ ...newCentre, machines: e.target.value })}
                  placeholder="e.g., CUT-01, CUT-02"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newCentre.is_active ? "active" : "inactive"}
                  onValueChange={(value: "active" | "inactive") => setNewCentre({ ...newCentre, is_active: value === "active" })}
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
              <Button onClick={handleAddCentre} className="w-full">
                Add Work Centre
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedCentres.map((centre) => (
          <Card
            key={centre.id}
            className={cn(
              "transition-all duration-200 hover:shadow-md",
              !centre.is_active && "opacity-60",
              draggedCentre === centre.id && "opacity-50 rotate-1",
            )}
            draggable
            onDragStart={(e) => handleDragStart(e, centre.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, centre.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                  {centre.name}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEditCentre(centre)} className="h-6 w-6 p-0">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(centre.id)}
                    className="h-6 w-6 p-0"
                  >
                    <Power className={cn("h-3 w-3", centre.is_active ? "text-green-600" : "text-gray-400")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCentre(centre.id)}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Capacity:</span>
                  <span className="font-medium">{centre.capacity} jobs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Currently:</span>
                  <span className="font-medium">{centre.current_jobs} active jobs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Machines:</span>
                  <span className="font-medium text-right">{centre.machines.map(m => m.name).join(", ")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={centre.is_active ? "default" : "secondary"}>
                    {centre.is_active ? "🟢 Active" : "🔴 Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCentre} onOpenChange={() => setEditingCentre(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Work Centre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Work Centre Name</Label>
              <Input
                id="edit-name"
                value={newCentre.name}
                onChange={(e) => setNewCentre({ ...newCentre, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-capacity">Capacity (Max Jobs)</Label>
              <Input
                id="edit-capacity"
                type="number"
                value={newCentre.capacity}
                onChange={(e) => setNewCentre({ ...newCentre, capacity: Number.parseInt(e.target.value) || 5 })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={newCentre.description}
                onChange={(e) => setNewCentre({ ...newCentre, description: e.target.value })}
                placeholder="Enter work centre description"
              />
            </div>
            <div>
              <Label htmlFor="edit-machines">Machines (comma-separated)</Label>
              <Input
                id="edit-machines"
                value={newCentre.machines}
                onChange={(e) => setNewCentre({ ...newCentre, machines: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={newCentre.is_active ? "active" : "inactive"}
                onValueChange={(value: "active" | "inactive") => setNewCentre({ ...newCentre, is_active: value === "active" })}
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
            <Button onClick={handleUpdateCentre} className="w-full">
              Update Work Centre
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
