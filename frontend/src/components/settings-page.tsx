"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CharacteristicSettings } from "@/components/characteristic-settings"
import { useAuth } from "@/contexts/auth-context"
import { userSettingsService } from "@/lib/api-services"
import type { UserCharacteristicSettings } from "@/types/manufacturing"
import { Palette, User, Bell } from "lucide-react"

export function SettingsPage() {
  const { user } = useAuth()
  const [characteristicSettings, setCharacteristicSettings] = useState<UserCharacteristicSettings>({
    enabled: false,
    enabledTypes: [],
    primaryCharacteristic: undefined,
    secondaryCharacteristic: undefined,
    colorAssignment: 'automatic'
  })

  // Load user's characteristics settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return
      
      try {
        const settings = await userSettingsService.getVisualCharacteristics(user.id)
        setCharacteristicSettings(settings)
      } catch (error) {
        console.error('Failed to load characteristics settings:', error)
        // Keep default settings
      }
    }

    loadSettings()
  }, [user])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please log in to access settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences and customize your experience.
        </p>
      </div>

      <Tabs defaultValue="visual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Visual Settings
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-6">
          <CharacteristicSettings
            userId={user.id}
            settings={characteristicSettings}
            onSettingsChange={setCharacteristicSettings}
          />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <p className="text-sm text-gray-600">
                Manage your account information and preferences.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <div className="text-sm text-gray-600 mt-1">{user.username}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <div className="text-sm text-gray-600 mt-1">{user.email}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <div className="text-sm text-gray-600 mt-1">{user.first_name || 'Not set'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <div className="text-sm text-gray-600 mt-1">{user.last_name || 'Not set'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <div className="text-sm text-gray-600 mt-1 capitalize">{user.role}</div>
                </div>
              </div>
              <div className="pt-4 text-sm text-gray-500">
                To update your profile information, please contact your system administrator.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <p className="text-sm text-gray-600">
                Configure how you receive notifications about system events.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Order Updates</div>
                    <div className="text-xs text-gray-500">Get notified when orders are moved or updated</div>
                  </div>
                  <div className="text-sm text-gray-500">Coming soon</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">System Alerts</div>
                    <div className="text-xs text-gray-500">Receive notifications about system maintenance and updates</div>
                  </div>
                  <div className="text-sm text-gray-500">Coming soon</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Planning Board Updates</div>
                    <div className="text-xs text-gray-500">Get notified about changes to the planning board</div>
                  </div>
                  <div className="text-sm text-gray-500">Coming soon</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}