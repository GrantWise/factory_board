"use client"

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
import type { LegacyWorkCentre, WorkCentre } from "@/types/manufacturing"
import { cn } from "@/lib/utils"
import { workCentresService } from "@/lib/api-services"
import { toast } from "sonner"

interface WorkCentresManagementProps {
  workCentres: LegacyWorkCentre[]
  originalWorkCentres?: WorkCentre[]
  onWorkCentreUpdate?: (workCentres: LegacyWorkCentre[]) => void
}

// Helper to find the numeric ID from code for API calls
// This requires access to the original work centres data from the API
// We'll pass this down or access it through a context/prop

export function WorkCentresManagement({ workCentres, originalWorkCentres, onWorkCentreUpdate }: WorkCentresManagementProps) {
  const [centres, setCentres] = useState<LegacyWorkCentre[]>(workCentres)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCentre, setEditingCentre] = useState<LegacyWorkCentre | null>(null)
  const [draggedCentre, setDraggedCentre] = useState<string | null>(null)

  // Helper function to find numeric ID from legacy code ID
  const findNumericId = (codeId: string): number | null => {
    if (!originalWorkCentres) return null
    const workCentre = originalWorkCentres.find(wc => wc.code === codeId)
    return workCentre ? workCentre.id : null
  }

  const [newCentre, setNewCentre] = useState({
    name: "",
    capacity: 5,
    machines: "",
    status: "active" as "active" | "inactive",
  })

  const handleAddCentre = async () => {
    try {
      if (!newCentre.name.trim()) {
        toast.error('Work centre name is required')
        return
      }

      const workCentreData = {
        name: newCentre.name.trim(),
        code: `WC-${newCentre.name.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`,
        capacity: newCentre.capacity,
        display_order: centres.length + 1,
      }

      await workCentresService.create(workCentreData)
      
      // Add machines if provided
      // Note: This would need additional API calls for each machine
      // For now, we'll handle this in a future enhancement
      
      onWorkCentreUpdate?.(centres) // Trigger refresh
      setIsAddDialogOpen(false)
      setNewCentre({ name: "", capacity: 5, machines: "", status: "active" })
      toast.success('Work centre created successfully')
    } catch (error: any) {
      toast.error(error.error || 'Failed to create work centre')
    }
  }

  const handleEditCentre = (centre: LegacyWorkCentre) => {
    setEditingCentre(centre)
    setNewCentre({
      name: centre.name,
      capacity: centre.capacity,
      machines: centre.machines.join(", "),
      status: centre.status,
    })
  }

  const handleUpdateCentre = async () => {
    if (!editingCentre) return

    try {
      if (!newCentre.name.trim()) {
        toast.error('Work centre name is required')
        return
      }

      // Find the numeric ID for the API call
      const numericId = findNumericId(editingCentre.id)
      
      if (!numericId) {
        toast.error('Work centre not found in system')
        return
      }

      const updates = {
        name: newCentre.name.trim(),
        capacity: newCentre.capacity,
        is_active: newCentre.status === 'active' ? 1 : 0,
      }

      await workCentresService.update(numericId, updates)

      onWorkCentreUpdate?.(centres) // Trigger refresh from API
      setEditingCentre(null)
      setNewCentre({ name: "", capacity: 5, machines: "", status: "active" })
      toast.success('Work centre updated successfully')
    } catch (error: any) {
      toast.error(error.error || 'Failed to update work centre')
    }
  }

  const handleDeleteCentre = async (centreId: string) => {
    try {
      if (!confirm('Are you sure you want to delete this work centre? This action cannot be undone.')) {
        return
      }

      // Find the numeric ID for the API call
      const numericId = findNumericId(centreId)
      
      if (!numericId) {
        toast.error('Work centre not found in system')
        return
      }

      await workCentresService.delete(numericId)

      onWorkCentreUpdate?.(centres) // Trigger refresh from API
      toast.success('Work centre deleted successfully')
    } catch (error: any) {
      toast.error(error.error || 'Failed to delete work centre')
    }
  }

  const handleToggleStatus = async (centreId: string) => {
    try {
      // Find the work centre to toggle
      const centre = centres.find(c => c.id === centreId)
      if (!centre) {
        toast.error('Work centre not found')
        return
      }

      // Find the numeric ID for the API call
      const numericId = findNumericId(centreId)
      
      if (!numericId) {
        toast.error('Work centre not found in system')
        return
      }

      const newStatus = centre.status === "active" ? "inactive" : "active"
      
      const updates = {
        is_active: newStatus === 'active' ? 1 : 0,
      }

      await workCentresService.update(numericId, updates)

      onWorkCentreUpdate?.(centres) // Trigger refresh from API
      toast.success(`Work centre ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`)
    } catch (error: any) {
      toast.error(error.error || 'Failed to update work centre status')
    }
  }

  const handleDragStart = (e: React.DragEvent, centreId: string) => {
    setDraggedCentre(centreId)
    e.dataTransfer.setData("text/plain", centreId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetCentreId: string) => {
    e.preventDefault()
    const draggedCentreId = e.dataTransfer.getData("text/plain")

    if (draggedCentreId === targetCentreId) return

    const draggedIndex = centres.findIndex((c) => c.id === draggedCentreId)
    const targetIndex = centres.findIndex((c) => c.id === targetCentreId)

    const newCentres = [...centres]
    const [draggedCentre] = newCentres.splice(draggedIndex, 1)
    newCentres.splice(targetIndex, 0, draggedCentre)

    // Update order values
    const updatedCentres = newCentres.map((centre, index) => ({
      ...centre,
      order: index + 1,
    }))

    setCentres(updatedCentres)
    onWorkCentreUpdate?.(updatedCentres)
    setDraggedCentre(null)
  }

  const sortedCentres = [...centres].sort((a, b) => a.order - b.order)

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
                  value={newCentre.status}
                  onValueChange={(value: "active" | "inactive") => setNewCentre({ ...newCentre, status: value })}
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
              centre.status === "inactive" && "opacity-60",
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
                    <Power className={cn("h-3 w-3", centre.status === "active" ? "text-green-600" : "text-gray-400")} />
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
                  <span className="font-medium">{centre.currentJobs} active jobs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Machines:</span>
                  <span className="font-medium text-right">{centre.machines.join(", ")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={centre.status === "active" ? "default" : "secondary"}>
                    {centre.status === "active" ? "🟢 Active" : "🔴 Inactive"}
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
                value={newCentre.status}
                onValueChange={(value: "active" | "inactive") => setNewCentre({ ...newCentre, status: value })}
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
