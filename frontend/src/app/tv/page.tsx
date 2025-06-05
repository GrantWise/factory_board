// TV Mode - Display-Only View for Manufacturing Planning Board
// Provides a high-contrast, large-font, read-only view for shop floor screens
// No controls, drag-and-drop, or editing. Auto-refreshes with real-time data.

'use client'

import { useApiData } from '@/hooks/use-api-data'
import { ordersService, workCentresService } from '@/lib/api-services'
import React, { useState, useEffect } from 'react'

export default function TVModePage() {
  // State for client-side timestamp to avoid hydration mismatch
  const [currentTime, setCurrentTime] = useState<string>('')
  
  // Fetch orders and work centres (auto-refresh every 15 seconds)
  const { data: ordersResponse } = useApiData(() => ordersService.getAll(), [], { autoRefresh: 15000 })
  const { data: workCentresResponse } = useApiData(() => workCentresService.getAll(), [], { autoRefresh: 30000 })
  const orders = ordersResponse?.orders || []
  const workCentres = workCentresResponse?.work_centres || []

  // Update timestamp on client side only
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString())
    }
    
    updateTime() // Set initial time
    const interval = setInterval(updateTime, 1000) // Update every second
    
    return () => clearInterval(interval)
  }, [])

  // Filter active work centres and sort by display order
  const activeWorkCentres = workCentres
    .filter(wc => wc.is_active)
    .sort((a, b) => a.display_order - b.display_order)

  const getOrdersForWorkCentre = (workCentreId: number) => {
    return orders.filter((order) => order.current_work_centre_id === workCentreId)
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold tracking-wide text-yellow-400 mb-2">
          Factory Planning Board
        </h1>
        <div className="text-xl text-gray-300">
          Live Production Status - Auto-refreshing every 15 seconds
        </div>
      </div>

      {/* Work Centres Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 min-h-0">
        {activeWorkCentres.map((workCentre) => {
          const workCentreOrders = getOrdersForWorkCentre(workCentre.id)
          
          return (
            <div key={workCentre.id} className="bg-gray-900 border-2 border-gray-700 rounded-lg p-4 flex flex-col min-h-[500px] max-h-[80vh]">
              {/* Work Centre Header */}
              <div className="mb-4 text-center border-b border-gray-700 pb-3 flex-shrink-0">
                <h2 className="text-2xl font-bold text-yellow-400 mb-1">
                  {workCentre.name}
                </h2>
                <div className="text-lg text-gray-300">
                  {workCentreOrders.length} {workCentreOrders.length === 1 ? 'Job' : 'Jobs'}
                </div>
              </div>

              {/* Orders List */}
              <div className="flex-1 space-y-3 overflow-y-auto min-h-0">
                {workCentreOrders.length === 0 ? (
                  <div className="text-center text-gray-500 text-lg py-8">
                    No orders assigned
                  </div>
                ) : (
                  workCentreOrders.map((order) => (
                    <div key={order.id} className="bg-gray-800 rounded-lg p-3 border border-gray-600 flex-shrink-0">
                      <div className="text-lg font-semibold text-white mb-1">
                        {order.order_number}
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        {order.stock_code} - {order.description}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="text-blue-300">
                          Progress: {order.quantity_completed}/{order.quantity_to_make}
                        </div>
                        <div className="text-green-300 font-medium">
                          {Math.round((order.quantity_completed / order.quantity_to_make) * 100)}%
                        </div>
                      </div>
                      {order.due_date && (
                        <div className="text-xs text-gray-400 mt-1">
                          Due: {new Date(order.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer with timestamp */}
      <div className="fixed bottom-4 right-6 text-sm text-gray-400 opacity-70">
        {currentTime && `Last updated: ${currentTime} • `}Auto-refreshing display
      </div>
    </div>
  )
} 