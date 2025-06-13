"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Edit2, Save, X } from "lucide-react"
import { characteristicsService } from "@/lib/api-services"
import { notify } from "@/lib/notifications"
import type { JobCharacteristic } from "@/types/manufacturing"
import type { AppError } from "@/lib/error-handling"

interface CharacteristicEditorProps {
  orderId: number
  characteristics: JobCharacteristic[]
  onUpdate: (characteristics: JobCharacteristic[]) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const CHARACTERISTIC_TYPES = [
  { value: "customer_order", label: "Customer Order", description: "Customer reference or order number" },
  { value: "customer", label: "Customer", description: "Customer name or identifier" },
  { value: "material", label: "Material", description: "Material type or grade" },
  { value: "priority", label: "Priority", description: "Business priority level" },
  { value: "part_family", label: "Part Family", description: "Product family or category" },
  { value: "custom", label: "Custom", description: "Custom characteristic type" }
]

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#6b7280"
]

export function CharacteristicEditor({ orderId, characteristics, onUpdate, open, onOpenChange }: CharacteristicEditorProps) {
  const [editingCharacteristics, setEditingCharacteristics] = useState<JobCharacteristic[]>([])
  const [newCharacteristic, setNewCharacteristic] = useState({
    type: "",
    value: "",
    color: PRESET_COLORS[0],
    display_name: ""
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize editing state when characteristics change
  useEffect(() => {
    setEditingCharacteristics([...characteristics])
  }, [characteristics])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setEditingCharacteristics([...characteristics])
      setNewCharacteristic({
        type: "",
        value: "",
        color: PRESET_COLORS[0],
        display_name: ""
      })
      setEditingId(null)
    }
  }, [open, characteristics])

  const handleAddCharacteristic = async () => {
    if (!newCharacteristic.type || !newCharacteristic.value.trim()) {
      notify.error('Please provide both type and value for the characteristic')
      return
    }

    setIsLoading(true)
    try {
      const created = await characteristicsService.createForOrder(orderId, {
        type: newCharacteristic.type as JobCharacteristic['type'],
        value: newCharacteristic.value.trim(),
        color: newCharacteristic.color,
        display_name: newCharacteristic.display_name.trim() || undefined
      })

      const updated = [...editingCharacteristics, created]
      setEditingCharacteristics(updated)
      onUpdate(updated)

      // Reset form
      setNewCharacteristic({
        type: "",
        value: "",
        color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        display_name: ""
      })

      notify.success({
        operation: 'add_characteristic',
        entity: 'characteristic'
      })
    } catch (error) {
      console.error('Failed to add characteristic:', error)
      notify.error(error as AppError, {
        operation: 'add_characteristic',
        entity: 'characteristic'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateCharacteristic = async (id: number, updates: Partial<JobCharacteristic>) => {
    setIsLoading(true)
    try {
      const updated = await characteristicsService.update(id, updates)
      
      const newCharacteristics = editingCharacteristics.map(char => 
        char.id === id ? updated : char
      )
      setEditingCharacteristics(newCharacteristics)
      onUpdate(newCharacteristics)
      setEditingId(null)

      notify.success({
        operation: 'update_characteristic',
        entity: 'characteristic'
      })
    } catch (error) {
      console.error('Failed to update characteristic:', error)
      notify.error(error as AppError, {
        operation: 'update_characteristic',
        entity: 'characteristic'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCharacteristic = async (id: number) => {
    if (!confirm('Are you sure you want to delete this characteristic? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    try {
      await characteristicsService.delete(id)
      
      const updated = editingCharacteristics.filter(char => char.id !== id)
      setEditingCharacteristics(updated)
      onUpdate(updated)

      notify.success({
        operation: 'delete_characteristic',
        entity: 'characteristic'
      })
    } catch (error) {
      console.error('Failed to delete characteristic:', error)
      notify.error(error as AppError, {
        operation: 'delete_characteristic',
        entity: 'characteristic'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (characteristic: JobCharacteristic) => {
    setEditingId(characteristic.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    // Reset any unsaved changes
    setEditingCharacteristics([...characteristics])
  }

  const updateEditingCharacteristic = (id: number, field: keyof JobCharacteristic, value: string) => {
    setEditingCharacteristics(prev => 
      prev.map(char => char.id === id ? { ...char, [field]: value } : char)
    )
  }

  const getTypeLabel = (type: string) => {
    const typeConfig = CHARACTERISTIC_TYPES.find(t => t.value === type)
    return typeConfig?.label || type
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order Characteristics</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Characteristics */}
          <div>
            <Label className="text-sm font-medium">Current Characteristics</Label>
            <div className="mt-2 space-y-3">
              {editingCharacteristics.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p className="text-sm">No characteristics added yet</p>
                  <p className="text-xs">Add characteristics below to enable visual grouping</p>
                </div>
              ) : (
                editingCharacteristics.map((characteristic) => (
                  <div key={characteristic.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {editingId === characteristic.id ? (
                      // Edit mode
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <Select
                          value={characteristic.type}
                          onValueChange={(value) => updateEditingCharacteristic(characteristic.id, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHARACTERISTIC_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={characteristic.value}
                          onChange={(e) => updateEditingCharacteristic(characteristic.id, 'value', e.target.value)}
                          placeholder="Value"
                        />
                        <Input
                          value={characteristic.display_name || ''}
                          onChange={(e) => updateEditingCharacteristic(characteristic.id, 'display_name', e.target.value)}
                          placeholder="Display name (optional)"
                        />
                        <div className="flex gap-1">
                          {PRESET_COLORS.slice(0, 6).map(color => (
                            <button
                              key={color}
                              className={`w-6 h-6 rounded border-2 ${characteristic.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => updateEditingCharacteristic(characteristic.id, 'color' as keyof JobCharacteristic, color)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex-1 flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: characteristic.color }}
                        />
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(characteristic.type)}
                        </Badge>
                        <span className="font-medium">{characteristic.value}</span>
                        {characteristic.display_name && (
                          <span className="text-sm text-muted-foreground">
                            ({characteristic.display_name})
                          </span>
                        )}
                        {characteristic.is_system_generated && (
                          <Badge variant="secondary" className="text-xs">
                            Auto
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1">
                      {editingId === characteristic.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateCharacteristic(characteristic.id, editingCharacteristics.find(c => c.id === characteristic.id)!)}
                            disabled={isLoading}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isLoading}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(characteristic)}
                            disabled={isLoading || characteristic.is_system_generated}
                            title={characteristic.is_system_generated ? "System-generated characteristics cannot be edited" : "Edit characteristic"}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteCharacteristic(characteristic.id)}
                            disabled={isLoading || characteristic.is_system_generated}
                            title={characteristic.is_system_generated ? "System-generated characteristics cannot be deleted" : "Delete characteristic"}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add New Characteristic */}
          <div>
            <Label className="text-sm font-medium">Add New Characteristic</Label>
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-type" className="text-xs">Type</Label>
                  <Select value={newCharacteristic.type} onValueChange={(value) => setNewCharacteristic(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHARACTERISTIC_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-value" className="text-xs">Value</Label>
                  <Input
                    id="new-value"
                    value={newCharacteristic.value}
                    onChange={(e) => setNewCharacteristic(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="e.g., CUST-001, Steel Grade A"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="new-display-name" className="text-xs">Display Name (Optional)</Label>
                  <Input
                    id="new-display-name"
                    value={newCharacteristic.display_name}
                    onChange={(e) => setNewCharacteristic(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Human-readable name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <div className="flex gap-1 mt-1">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        className={`w-6 h-6 rounded border-2 ${newCharacteristic.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewCharacteristic(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <Button 
                onClick={handleAddCharacteristic}
                disabled={isLoading || !newCharacteristic.type || !newCharacteristic.value.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Characteristic
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}