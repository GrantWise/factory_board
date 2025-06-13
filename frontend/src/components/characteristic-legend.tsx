"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EyeOff, ChevronUp, ChevronDown } from "lucide-react"
import type { JobCharacteristic, UserCharacteristicSettings } from "@/types/manufacturing"

interface CharacteristicLegendProps {
  characteristics: JobCharacteristic[]
  settings: UserCharacteristicSettings
  onToggleVisibility?: () => void
  compact?: boolean
  collapsed?: boolean
  onToggleCollapse?: (collapsed: boolean) => void
}

export function CharacteristicLegend({ 
  characteristics, 
  settings, 
  onToggleVisibility,
  compact = false,
  collapsed = false,
  onToggleCollapse
}: CharacteristicLegendProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  
  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed
  const toggleCollapse = onToggleCollapse || setInternalCollapsed
  const groupedCharacteristics = useMemo(() => {
    // Group characteristics by type
    const grouped = characteristics.reduce((acc, char) => {
      if (!acc[char.type]) {
        acc[char.type] = []
      }
      acc[char.type].push(char)
      return acc
    }, {} as Record<string, JobCharacteristic[]>)

    // Sort by type and then by value within each type
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => (a.value || '').localeCompare(b.value || ''))
    })

    return grouped
  }, [characteristics])

  const activeTypes = useMemo(() => {
    return [settings.primaryCharacteristic, settings.secondaryCharacteristic]
      .filter(Boolean) as string[]
  }, [settings.primaryCharacteristic, settings.secondaryCharacteristic])

  const formatCharacteristicTypeName = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  if (!settings.enabled || activeTypes.length === 0 || characteristics.length === 0) {
    return null
  }

  if (compact) {
    return (
      <div className="bg-gray-50 border rounded-lg p-2 mb-2">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-medium text-gray-700">Visual Grouping</h4>
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              className="h-6 w-6 p-0"
            >
              <EyeOff className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {activeTypes.map(type => {
            const items = groupedCharacteristics[type] || []
            return items.slice(0, 3).map(item => (
              <div 
                key={`compact-${item.id}`}
                className="flex items-center gap-1 text-xs"
              >
                <div 
                  className="w-2 h-2 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600">
                  {item.display_name || item.value}
                </span>
              </div>
            ))
          })}
        </div>
      </div>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Visual Grouping Legend</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleCollapse(!isCollapsed)}
              className="h-8 w-8 p-0"
              title={isCollapsed ? "Expand legend" : "Collapse legend"}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            {onToggleVisibility && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleVisibility}
                className="h-8 w-8 p-0"
                title="Hide legend"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
        <div className="space-y-3">
          {activeTypes.map(type => {
            const items = groupedCharacteristics[type] || []
            const isPrimary = type === settings.primaryCharacteristic
            
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {formatCharacteristicTypeName(type)}
                  </span>
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                  >
                    {isPrimary ? 'Primary' : 'Secondary'}
                  </Badge>
                  {isPrimary && (
                    <span className="text-xs text-gray-500">
                      (Background & top stripe)
                    </span>
                  )}
                  {!isPrimary && (
                    <span className="text-xs text-gray-500">
                      (Left edge stripe)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.slice(0, 8).map(item => (
                    <div 
                      key={`full-${item.id}`}
                      className="flex items-center gap-2 text-sm bg-white border rounded-md px-2 py-1"
                    >
                      <div 
                        className="w-3 h-3 rounded flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-700">
                        {item.display_name || item.value}
                      </span>
                    </div>
                  ))}
                  {items.length > 8 && (
                    <div className="flex items-center text-xs text-gray-500 px-2 py-1">
                      +{items.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded" />
              <span>Primary: Colors the entire card background</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded" />
              <span>Secondary: Shows as left edge stripe</span>
            </div>
          </div>
        </div>
        </CardContent>
      )}
    </Card>
  )
}