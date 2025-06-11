"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import type { 
  UserCharacteristicSettings, 
  AvailableCharacteristic, 
  JobCharacteristic 
} from "@/types/manufacturing"
import { characteristicsService, userSettingsService } from "@/lib/api-services"
import { Package, Building, Layers, AlertTriangle, Grid3X3, Tag } from "lucide-react"

interface CharacteristicSettingsProps {
  userId: number
  settings: UserCharacteristicSettings
  onSettingsChange: (settings: UserCharacteristicSettings) => void
}

interface OrderCardPreviewProps {
  settings: UserCharacteristicSettings
  availableCharacteristics: AvailableCharacteristic[]
}

function OrderCardPreview({ settings, availableCharacteristics }: OrderCardPreviewProps) {
  // Create mock characteristics for preview
  const mockCharacteristics: JobCharacteristic[] = []
  
  // Only show characteristics that are enabled
  const enabledTypes = settings.enabledTypes || []
  enabledTypes.forEach(typeKey => {
    const charType = availableCharacteristics.find(c => c.type === typeKey)
    if (charType) {
      mockCharacteristics.push({
        id: mockCharacteristics.length + 1,
        order_id: 1,
        type: typeKey as any,
        value: getSampleValue(typeKey),
        color: charType.sample_color,
        display_name: `${charType.name}: ${getSampleValue(typeKey)}`,
        is_system_generated: true,
        created_at: new Date().toISOString()
      })
    }
  })

  function getSampleValue(typeKey: string): string {
    const samples = {
      'customer_order': 'PO12345',
      'customer': 'ACME Corp',
      'material': 'Steel',
      'priority': 'High',
      'part_family': 'BRACKET',
      'custom': 'Sample'
    }
    return samples[typeKey as keyof typeof samples] || 'Sample'
  }

  const primaryChar = mockCharacteristics.find(c => 
    c.type === settings.primaryCharacteristic
  )
  const secondaryChar = mockCharacteristics.find(c => 
    c.type === settings.secondaryCharacteristic
  )

  const showCharacteristics = settings.enabled && (primaryChar || secondaryChar)

  return (
    <div 
      className="border rounded-lg p-3 bg-white relative min-h-[100px]"
      style={{
        backgroundColor: primaryChar ? `${primaryChar.color}08` : undefined
      }}
    >
      {/* Primary characteristic color stripe at top */}
      {showCharacteristics && primaryChar && (
        <div 
          className="h-2 w-full rounded-t-md absolute top-0 left-0 right-0"
          style={{ backgroundColor: primaryChar.color }}
        />
      )}
      
      {/* Secondary characteristic color band on left edge */}
      {showCharacteristics && secondaryChar && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
          style={{ backgroundColor: secondaryChar.color }}
        />
      )}

      <div className={`${showCharacteristics && primaryChar ? 'mt-3' : ''} ${showCharacteristics && secondaryChar ? 'ml-2' : ''}`}>
        <div className="font-medium text-sm mb-1">Sample Order #12345</div>
        <div className="text-xs text-gray-600 mb-2">Widget Assembly - Part ABC123</div>
        
        {/* Characteristic badges */}
        {showCharacteristics && mockCharacteristics.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {mockCharacteristics.slice(0, 3).map((char) => (
              <Badge 
                key={char.type}
                variant="secondary" 
                className="text-xs"
                style={{ 
                  backgroundColor: `${char.color}20`,
                  color: char.color,
                  borderColor: char.color
                }}
              >
                {char.value}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getIconForType(iconName: string) {
  const icons = {
    'Package': Package,
    'Building': Building,
    'Layers': Layers,
    'AlertTriangle': AlertTriangle,
    'Grid3x3': Grid3X3,
    'Tag': Tag
  }
  const IconComponent = icons[iconName as keyof typeof icons] || Tag
  return IconComponent
}

export function CharacteristicSettings({ userId, settings, onSettingsChange }: CharacteristicSettingsProps) {
  const [availableCharacteristics, setAvailableCharacteristics] = useState<AvailableCharacteristic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadAvailableCharacteristics()
  }, [])

  const loadAvailableCharacteristics = async () => {
    try {
      const response = await characteristicsService.getAll()
      setAvailableCharacteristics(response.available)
    } catch (error) {
      console.error('Failed to load available characteristics:', error)
      toast({
        title: "Error",
        description: "Failed to load available characteristics",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSettingsUpdate = async (newSettings: UserCharacteristicSettings) => {
    setSaving(true)
    try {
      await userSettingsService.setVisualCharacteristics(userId, newSettings)
      onSettingsChange(newSettings)
      toast({
        title: "Settings saved",
        description: "Visual characteristics settings have been updated",
      })
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCharacteristicToggle = (typeKey: string, enabled: boolean) => {
    const currentEnabledTypes = settings.enabledTypes || []
    const newEnabledTypes = enabled 
      ? [...currentEnabledTypes, typeKey]
      : currentEnabledTypes.filter(t => t !== typeKey)
    
    // Clear primary/secondary if they're being disabled
    let newPrimary = settings.primaryCharacteristic
    let newSecondary = settings.secondaryCharacteristic
    
    if (!enabled) {
      if (settings.primaryCharacteristic === typeKey) {
        newPrimary = undefined
      }
      if (settings.secondaryCharacteristic === typeKey) {
        newSecondary = undefined
      }
    }

    handleSettingsUpdate({
      ...settings,
      enabledTypes: newEnabledTypes,
      primaryCharacteristic: newPrimary,
      secondaryCharacteristic: newSecondary
    })
  }

  const getEnabledCharacteristics = () => {
    const enabledTypes = settings.enabledTypes || []
    return availableCharacteristics.filter(char => 
      enabledTypes.includes(char.type)
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visual Job Grouping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visual Job Grouping</CardTitle>
        <p className="text-sm text-gray-600">
          Configure how job cards are visually grouped by characteristics like customer order, material type, or priority.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="enable-characteristics" className="text-base font-medium">
            Enable Visual Grouping
          </Label>
          <Switch
            id="enable-characteristics"
            checked={settings.enabled || false}
            onCheckedChange={(enabled) => 
              handleSettingsUpdate({ ...settings, enabled })
            }
            disabled={saving}
          />
        </div>

        {settings.enabled && (
          <div className="space-y-6 pl-4 border-l-2 border-gray-200">
            {/* Available Characteristic Types */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Available Characteristic Types
              </Label>
              <p className="text-xs text-gray-500 mb-4">
                Enable the characteristic types you want to use for visual grouping
              </p>
              
              <div className="space-y-3">
                {availableCharacteristics.map(char => {
                  const IconComponent = getIconForType(char.icon)
                  const enabledTypes = settings.enabledTypes || []
                  const isEnabled = enabledTypes.includes(char.type)
                  
                  return (
                    <div key={char.type} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="font-medium text-sm">{char.name}</div>
                          <div className="text-xs text-gray-500">{char.description}</div>
                          {char.value_count > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {char.value_count} values in use
                            </div>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(enabled) => 
                          handleCharacteristicToggle(char.type, enabled)
                        }
                        disabled={saving}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Primary and Secondary Selection */}
            {(settings.enabledTypes || []).length > 0 && (
              <div className="space-y-4">
                {/* Primary Characteristic */}
                <div>
                  <Label className="text-sm font-medium">
                    Primary Grouping (Card Background & Top Stripe)
                  </Label>
                  <p className="text-xs text-gray-500 mb-2">
                    This will be the main visual grouping shown with background tint and top color stripe
                  </p>
                  <Select 
                    value={settings.primaryCharacteristic || 'none'}
                    onValueChange={(value) => 
                      handleSettingsUpdate({ 
                        ...settings, 
                        primaryCharacteristic: value === "none" ? undefined : value 
                      })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose primary grouping..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {getEnabledCharacteristics().map(char => (
                        <SelectItem key={char.type} value={char.type}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: char.sample_color }}
                            />
                            <span>{char.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Secondary Characteristic */}
                <div>
                  <Label className="text-sm font-medium">
                    Secondary Grouping (Left Edge Stripe)
                  </Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Optional secondary grouping shown as a colored stripe on the left edge
                  </p>
                  <Select 
                    value={settings.secondaryCharacteristic || 'none'}
                    onValueChange={(value) => 
                      handleSettingsUpdate({ 
                        ...settings, 
                        secondaryCharacteristic: value === "none" ? undefined : value 
                      })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional secondary grouping..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {getEnabledCharacteristics()
                        .filter(char => char.type !== settings.primaryCharacteristic)
                        .map(char => (
                          <SelectItem key={char.type} value={char.type}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: char.sample_color }}
                              />
                              <span>{char.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Color Assignment Method */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Color Assignment</Label>
              <RadioGroup 
                value={settings.colorAssignment || 'automatic'}
                onValueChange={(value: 'automatic' | 'manual') =>
                  handleSettingsUpdate({ ...settings, colorAssignment: value })
                }
                disabled={saving}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="automatic" id="automatic" />
                  <Label htmlFor="automatic" className="text-sm">
                    Automatic (system assigns consistent colors)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="text-sm">
                    Manual (choose colors yourself)
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* Preview */}
            {(settings.enabledTypes || []).length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Preview</Label>
                <OrderCardPreview 
                  settings={settings} 
                  availableCharacteristics={availableCharacteristics}
                />
              </div>
            )}

            {/* Help Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-800">
                <strong>How it works:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Enable the characteristic types you want to use for grouping</li>
                  <li>Job cards will be automatically colored based on detected or assigned characteristics</li>
                  <li>Similar orders will have the same colors for easy visual grouping</li>
                  <li>Characteristics are detected from order descriptions, stock codes, and other fields</li>
                  <li>You can change these settings at any time</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {availableCharacteristics.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No characteristic types available.</p>
            <p className="text-sm">Please contact your administrator.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}