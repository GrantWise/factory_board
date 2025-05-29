"use client"

import { useState, useEffect } from "react"
import { io, type Socket } from "socket.io-client"

interface User {
  userId: string
  userName: string
  lockingOrder?: string
}

interface UseWebSocketReturn {
  socket: Socket | null
  connectedUsers: User[]
  lockedOrders: Set<string>
  isConnected: boolean
}

export function useWebSocket(currentUser: { id: string; name: string }): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connectedUsers, setConnectedUsers] = useState<User[]>([])
  const [lockedOrders, setLockedOrders] = useState<Set<string>>(new Set())
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // In a real implementation, this would be your WebSocket server URL
    // For demo purposes, we'll simulate WebSocket behavior
    const ws = io("ws://localhost:3001", {
      autoConnect: false,
      reconnection: true,
    })

    // Simulate connection
    setTimeout(() => {
      setSocket(ws as unknown as Socket)
      setIsConnected(true)

      // Add current user to connected users
      setConnectedUsers([
        {
          userId: currentUser.id,
          userName: currentUser.name,
        },
        // Simulate some other users for demo
        {
          userId: "user-2",
          userName: "Jane Smith",
        },
        {
          userId: "user-3",
          userName: "Bob Johnson",
        },
      ])
    }, 500)

    // Handle incoming events (simulated)
    const handleOrderLocked = (data: { orderId: string; userId: string; userName: string }) => {
      setLockedOrders((prev) => new Set([...prev, data.orderId]))
      setConnectedUsers((prev) =>
        prev.map((user) => (user.userId === data.userId ? { ...user, lockingOrder: data.orderId } : user)),
      )
    }

    const handleOrderUnlocked = (data: { orderId: string; userId: string }) => {
      setLockedOrders((prev) => {
        const newSet = new Set(prev)
        newSet.delete(data.orderId)
        return newSet
      })
      setConnectedUsers((prev) =>
        prev.map((user) => (user.userId === data.userId ? { ...user, lockingOrder: undefined } : user)),
      )
    }

    // Cleanup function
    return () => {
      setIsConnected(false)
    }
  }, [currentUser])

  return { socket, connectedUsers, lockedOrders, isConnected }
}
