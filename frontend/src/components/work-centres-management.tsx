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
import type { WorkCentre } from "@/types/manufacturing"
import { cn } from "@/lib/utils"

interface WorkCentresManagementProps {
  workCentres: WorkCentre[]
  onWorkCentreUpdate?: (workCentres: WorkCentre[]) => void
}

export function WorkCentresManagement({ workCentres, onWorkCentreUpdate }: WorkCentresManagementProps) {
  const [centres, setCentres] = useState<WorkCentre[]>(workCentres)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCentre, setEditingCentre] = useState<WorkCentre | null>(null)
  const [draggedCentre, setDraggedCentre] = useState<string | null>(null)

  const [newCentre, setNewCentre] = useState({
    name: "",
    capacity: 5,
    machines: "",
    status: "active" as "active" | "inactive",
  })

  const handleAddCentre = () => {
    const centre: WorkCentre = {
      id: `WC-${Date.now()}`,
      name: newCentre.name,
      capacity: newCentre.capacity,
      currentJobs: 0,
      machines: newCentre.machines
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      status: newCentre.status,
      order: centres.length + 1,
    }

    const updatedCentres = [...centres, centre]
    setCentres(updatedCentres)
    onWorkCentreUpdate?.(updatedCentres)
    setIsAddDialogOpen(false)
    setNewCentre({ name: "", capacity: 5, machines: "", status: "active" })
  }

  const handleEditCentre = (centre: WorkCentre) => {
    setEditingCentre(centre)
    setNewCentre({
      name: centre.name,
      capacity: centre.capacity,
      machines: centre.machines.join(", "),
      status: centre.status,
    })
  }

  const handleUpdateCentre = () => {
    if (!editingCentre) return

    const updatedCentres = centres.map((centre) =>
      centre.id === editingCentre.id
        ? {
            ...centre,
            name: newCentre.name,
            capacity: newCentre.capacity,
            machines: newCentre.machines
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean),
            status: newCentre.status,
          }
        : centre,
    )

    setCentres(updatedCentres)
    onWorkCentreUpdate?.(updatedCentres)
    setEditingCentre(null)
    setNewCentre({ name: "", capacity: 5, machines: "", status: "active" })
  }

  const handleDeleteCentre = (centreId: string) => {
    const updatedCentres = centres.filter((centre) => centre.id !== centreId)
    setCentres(updatedCentres)
    onWorkCentreUpdate?.(updatedCentres)
  }

  const handleToggleStatus = (centreId: string) => {
    const updatedCentres = centres.map((centre) =>
      centre.id === centreId
        ? { ...centre, status: centre.status === "active" ? ("inactive" as const) : ("active" as const) }
        : centre,
    )
    setCentres(updatedCentres)
    onWorkCentreUpdate?.(updatedCentres)
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
