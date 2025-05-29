"use client"

import { Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface User {
  userId: string
  userName: string
  lockingOrder?: string
}

interface OnlineUsersIndicatorProps {
  connectedUsers: User[]
}

export function OnlineUsersIndicator({ connectedUsers }: OnlineUsersIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Users size={16} />
      <span>Online: {connectedUsers.length}</span>
      <div className="flex -space-x-2">
        <TooltipProvider>
          {connectedUsers.slice(0, 3).map((user) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div
                  className="w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-xs border border-white"
                  title={user.userName}
                >
                  {user.userName.charAt(0).toUpperCase()}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{user.userName}</p>
                {user.lockingOrder && <p className="text-xs">Moving an order</p>}
              </TooltipContent>
            </Tooltip>
          ))}
          {connectedUsers.length > 3 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs border border-white">
                  +{connectedUsers.length - 3}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{connectedUsers.length - 3} more users online</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  )
}
