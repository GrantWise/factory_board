"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"

// Mimic the types from the main board
interface ManufacturingOrder {
  id: number
  order_number: string
  description: string
  current_work_centre_id: number
}

interface WorkCentre {
  id: number
  name: string
}

// Mock data
const initialWorkCentres: WorkCentre[] = [
  { id: 1, name: "Cutting" },
  { id: 2, name: "Assembly" },
]

const initialOrders: ManufacturingOrder[] = [
  { id: 101, order_number: "MO-101", description: "Widget A", current_work_centre_id: 1 },
  { id: 102, order_number: "MO-102", description: "Widget B", current_work_centre_id: 1 },
  { id: 201, order_number: "MO-201", description: "Widget C", current_work_centre_id: 2 },
]

function getOrdersForWorkCentre(orders: ManufacturingOrder[], workCentreId: number) {
  return orders.filter(order => order.current_work_centre_id === workCentreId)
}

function DraggableCard({ order, onDragStart, isDragging }: {
  order: ManufacturingOrder
  onDragStart: (order: ManufacturingOrder) => void
  isDragging: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const cleanup = draggable({
      element: ref.current,
      getInitialData: () => ({ id: order.id }),
      onDragStart: () => onDragStart(order),
  })
    return cleanup
  }, [order, onDragStart])

  return (
    <div
      ref={ref}
      className={
        "bg-white rounded shadow p-3 border cursor-grab active:cursor-grabbing transition-opacity" +
        (isDragging ? " opacity-50" : "")
      }
      style={{ zIndex: isDragging ? 100 : undefined }}
      tabIndex={0}
    >
      <div className="font-medium">{order.order_number}</div>
      <div className="text-sm text-gray-600">{order.description}</div>
    </div>
  )
}

export default function KanbanDndDemoPage() {
  const [orders, setOrders] = useState(initialOrders)
  const [activeCardId, setActiveCardId] = useState<number | null>(null)
  const workCentres = initialWorkCentres


  // Refs for drop targets
  const dropRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Setup drop targets
  useEffect(() => {
    workCentres.forEach(wc => {
      const node = dropRefs.current[wc.id]
      if (!node) return
      const cleanup = dropTargetForElements({
        element: node,
        getData: () => ({ workCentreId: wc.id }),
      })
      return cleanup
    })
  }, [workCentres])

  // Monitor for drag events
  useEffect(() => {
    const cleanup = monitorForElements({
      onDrop: ({ source, location }) => {
        // Find the innermost drop target (column)
        const dropTargets = location.current.dropTargets
        if (!source.data || !dropTargets.length) return
        const cardId = source.data.id
        // Find the first drop target with workCentreId
        const colTarget = dropTargets.find(t => t.data && typeof t.data.workCentreId === 'number')
        if (!colTarget) return
        const targetColId = Number(colTarget.data.workCentreId)
    if (!workCentres.some(wc => wc.id === targetColId)) return
    setOrders(prev =>
      prev.map(order =>
        order.id === cardId ? { ...order, current_work_centre_id: targetColId } : order
      )
    )
        setActiveCardId(null)
      },
      onDragStart: ({ source }) => {
        if (source.data && typeof source.data.id === "number") {
          setActiveCardId(source.data.id)
        }
      },
    })
    return cleanup
  }, [orders, workCentres])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Minimal Kanban DnD Demo (Atlassian Pragmatic DnD)</h1>
        <div className="grid grid-cols-2 gap-8">
          {workCentres.map((wc) => {
            return (
              <div
                key={String(wc.id)}
              ref={el => { dropRefs.current[wc.id] = el }}
              style={{ minHeight: 400, background: "#eee" }}
                className={
                "rounded-lg p-4 transition-all duration-200 border-2"
                }
                data-col-id={String(wc.id)}
              >
                <h2 className="text-lg font-semibold mb-4">{wc.name}</h2>
                <div className="space-y-2">
                  {getOrdersForWorkCentre(orders, wc.id).map((order) => (
                  <DraggableCard
                    key={String(order.id)}
                    order={order}
                    onDragStart={() => {}}
                    isDragging={activeCardId === order.id}
                  />
                  ))}
                  {getOrdersForWorkCentre(orders, wc.id).length === 0 && (
                    <div className="text-gray-400 text-center py-8 border-2 border-dashed rounded">
                      No orders assigned
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      {/* Drag preview overlay (optional, native preview used by default) */}
      {/* You can add a custom preview if desired using a portal, but Atlassian DnD uses the browser preview by default */}
    </div>
  )
} 