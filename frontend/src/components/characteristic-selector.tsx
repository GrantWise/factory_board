"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Plus, Search } from "lucide-react"
import { characteristicsService } from "@/lib/api-services"
import { notify } from "@/lib/notifications"
import type { JobCharacteristic } from "@/types/manufacturing"

interface CharacteristicSelectorProps {
  onSelect: (characteristic: { type: string; value: string; color?: string; display_name?: string }) => void
  excludeExisting?: JobCharacteristic[]
  className?: string
}

const CHARACTERISTIC_TYPES = [
  { value: "customer_order", label: "Customer Order", icon: "🏢" },
  { value: "customer", label: "Customer", icon: "👤" },
  { value: "material", label: "Material", icon: "🔧" },
  { value: "priority", label: "Priority", icon: "⚡" },
  { value: "part_family", label: "Part Family", icon: "📦" },
  { value: "custom", label: "Custom", icon: "⚙️" }
]

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#6b7280"
]

export function CharacteristicSelector({ onSelect, excludeExisting = [], className }: CharacteristicSelectorProps) {
  const [existingValues, setExistingValues] = useState<Record<string, JobCharacteristic[]>>({})
  const [selectedType, setSelectedType] = useState<string>("__all__")
  const [searchTerm, setSearchTerm] = useState("")
  const [customValue, setCustomValue] = useState("")
  const [customDisplayName, setCustomDisplayName] = useState("")
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
  const [mode, setMode] = useState<"select" | "create">("select")


  useEffect(() => {
    if (selectedType && selectedType !== "__all__") {
      loadExistingValues(selectedType)
    }
  }, [selectedType])


  const loadExistingValues = async (type: string) => {
    try {
      const values = await characteristicsService.getByType(type)
      setExistingValues(prev => ({ ...prev, [type]: values }))
    } catch (error) {
      console.error('Failed to load existing values:', error)
    }
  }

  const getTypeConfig = (type: string) => {
    return CHARACTERISTIC_TYPES.find(t => t.value === type) || { value: type, label: type, icon: "📋" }
  }

  const getFilteredValues = (type: string) => {
    const values = existingValues[type] || []
    const excludeValues = excludeExisting
      .filter(char => char.type === type)
      .map(char => char.value.toLowerCase())
    
    const filtered = values.filter(val => 
      !excludeValues.includes(val.value.toLowerCase()) &&
      val.value.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Deduplicate by value
    const seen = new Set()
    return filtered.filter(val => {
      if (seen.has(val.value)) return false
      seen.add(val.value)
      return true
    })
  }

  const handleSelectExisting = (characteristic: JobCharacteristic) => {
    onSelect({
      type: characteristic.type,
      value: characteristic.value,
      color: characteristic.color,
      display_name: characteristic.display_name
    })
    resetForm()
  }

  const handleCreateNew = () => {
    if (!selectedType || !customValue.trim()) {
      notify.error('Please provide both type and value')
      return
    }

    onSelect({
      type: selectedType,
      value: customValue.trim(),
      color: selectedColor,
      display_name: customDisplayName.trim() || undefined
    })
    resetForm()
  }

  const resetForm = () => {
    setSelectedType("__all__")
    setSearchTerm("")
    setCustomValue("")
    setCustomDisplayName("")
    setSelectedColor(PRESET_COLORS[0])
    setMode("select")
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Mode Selection */}
      <div className="flex gap-2">
        <Button
          variant={mode === "select" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("select")}
        >
          Choose Existing
        </Button>
        <Button
          variant={mode === "create" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("create")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Create New
        </Button>
      </div>

      {mode === "select" ? (
        /* Select Existing Mode */
        <div className="space-y-3">
          {/* Type Filter */}
          <div>
            <Label className="text-xs">Filter by Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {CHARACTERISTIC_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div>
            <Label className="text-xs">Search Values</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search characteristic values..."
                className="pl-8"
              />
            </div>
          </div>

          {/* Available Values */}
          <div>
            <Label className="text-xs">Available Values</Label>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {selectedType && selectedType !== "__all__" ? (
                  getFilteredValues(selectedType).length > 0 ? (
                    getFilteredValues(selectedType).map((characteristic, index) => (
                      <div
                        key={`${characteristic.type}-${characteristic.value}-${index}`}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                        onClick={() => handleSelectExisting(characteristic)}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: characteristic.color }}
                          />
                          <span className="text-sm font-medium">{characteristic.value}</span>
                          {characteristic.display_name && (
                            <span className="text-xs text-muted-foreground">
                              ({characteristic.display_name})
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {getTypeConfig(characteristic.type).icon} {getTypeConfig(characteristic.type).label}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No existing values found</p>
                      <p className="text-xs">Try creating a new one instead</p>
                    </div>
                  )
                ) : (
                  /* Show all types when no filter selected */
                  CHARACTERISTIC_TYPES.map(typeConfig => {
                    const values = getFilteredValues(typeConfig.value)
                    if (values.length === 0) return null

                    return (
                      <div key={typeConfig.value}>
                        <div className="font-medium text-xs text-muted-foreground uppercase tracking-wide py-1">
                          {typeConfig.icon} {typeConfig.label}
                        </div>
                        {values.slice(0, 3).map((characteristic, index) => (
                          <div
                            key={`${characteristic.type}-${characteristic.value}-${index}`}
                            className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer ml-2"
                            onClick={() => handleSelectExisting(characteristic)}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: characteristic.color }}
                              />
                              <span className="text-sm">{characteristic.value}</span>
                            </div>
                          </div>
                        ))}
                        {values.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center py-1">
                            +{values.length - 3} more...
                          </div>
                        )}
                        <Separator className="my-2" />
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        /* Create New Mode */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTERISTIC_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {type.value === "customer_order" && "Customer reference numbers"}
                            {type.value === "customer" && "Customer identifiers"}
                            {type.value === "material" && "Material types and grades"}
                            {type.value === "priority" && "Business priority levels"}
                            {type.value === "part_family" && "Product categories"}
                            {type.value === "custom" && "Custom groupings"}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="e.g., CUST-001, Steel-A"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Display Name (Optional)</Label>
            <Input
              value={customDisplayName}
              onChange={(e) => setCustomDisplayName(e.target.value)}
              placeholder="Human-readable name"
            />
          </div>

          <div>
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1 mt-1">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded border-2 ${selectedColor === color ? 'border-gray-900' : 'border-gray-300'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          <Button 
            onClick={handleCreateNew}
            disabled={!selectedType || !customValue.trim()}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Characteristic
          </Button>
        </div>
      )}
    </div>
  )
}