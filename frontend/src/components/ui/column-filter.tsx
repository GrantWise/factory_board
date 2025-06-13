"use client"

import * as React from "react"
import { Column } from "@tanstack/react-table"
import { X, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface ColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  options?: Array<{
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }>
  type?: "text" | "number" | "date" | "select"
}

export function ColumnFilter<TData, TValue>({
  column,
  title,
  options,
  type = "text"
}: ColumnFilterProps<TData, TValue>) {
  const facets = column.getFacetedUniqueValues()
  const selectedValues = new Set(column.getFilterValue() as string[])

  // Text filter component
  const TextFilter = () => {
    const [value, setValue] = React.useState((column.getFilterValue() as string) ?? "")
    
    return (
      <div className="px-3 py-2">
        <Label className="text-xs font-medium text-muted-foreground">Filter by {title}</Label>
        <Input
          placeholder={`Search ${title.toLowerCase()}...`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            column.setFilterValue(e.target.value || undefined)
          }}
          className="mt-2 h-8"
        />
      </div>
    )
  }

  // Number range filter component
  const NumberFilter = () => {
    const [min, setMin] = React.useState("")
    const [max, setMax] = React.useState("")
    const currentFilter = column.getFilterValue() as [number, number] | undefined

    React.useEffect(() => {
      if (currentFilter) {
        setMin(currentFilter[0]?.toString() || "")
        setMax(currentFilter[1]?.toString() || "")
      }
    }, [currentFilter])

    const handleApply = () => {
      const minNum = min ? parseFloat(min) : undefined
      const maxNum = max ? parseFloat(max) : undefined
      
      if (minNum !== undefined || maxNum !== undefined) {
        column.setFilterValue([minNum, maxNum])
      } else {
        column.setFilterValue(undefined)
      }
    }

    return (
      <div className="px-3 py-2 space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Filter by {title}</Label>
        <div className="flex space-x-2">
          <Input
            placeholder="Min"
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-8"
          />
          <Input
            placeholder="Max"
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-8"
          />
        </div>
        <Button onClick={handleApply} size="sm" className="w-full">
          Apply
        </Button>
      </div>
    )
  }

  // Date filter component
  const DateFilter = () => {
    const [fromDate, setFromDate] = React.useState("")
    const [toDate, setToDate] = React.useState("")

    const handleApply = () => {
      if (fromDate || toDate) {
        column.setFilterValue({ from: fromDate, to: toDate })
      } else {
        column.setFilterValue(undefined)
      }
    }

    const presetFilters = [
      { label: "Today", value: () => {
        const today = new Date().toISOString().split('T')[0]
        setFromDate(today)
        setToDate(today)
      }},
      { label: "Last 7 days", value: () => {
        const today = new Date()
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        setFromDate(lastWeek.toISOString().split('T')[0])
        setToDate(today.toISOString().split('T')[0])
      }},
      { label: "Last 30 days", value: () => {
        const today = new Date()
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        setFromDate(lastMonth.toISOString().split('T')[0])
        setToDate(today.toISOString().split('T')[0])
      }},
    ]

    return (
      <div className="px-3 py-2 space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">Filter by {title}</Label>
        
        {/* Quick presets */}
        <div className="space-y-1">
          {presetFilters.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="w-full justify-start h-8"
              onClick={preset.value}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <Separator />

        {/* Custom range */}
        <div className="space-y-2">
          <Label className="text-xs">Custom Range</Label>
          <div className="space-y-2">
            <Input
              type="date"
              placeholder="From"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8"
            />
            <Input
              type="date"
              placeholder="To"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8"
            />
          </div>
          <Button onClick={handleApply} size="sm" className="w-full">
            Apply
          </Button>
        </div>
      </div>
    )
  }

  // Select filter component (for status, priority, etc.)
  const SelectFilter = () => {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">Filter by {title}</Label>
          {selectedValues.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => column.setFilterValue(undefined)}
            >
              Clear
            </Button>
          )}
        </div>
        
        {selectedValues.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Array.from(selectedValues).map((value) => (
              <Badge key={value} variant="secondary" className="text-xs">
                {options?.find(option => option.value === value)?.label || value}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => {
                    const newSelectedValues = new Set(selectedValues)
                    newSelectedValues.delete(value)
                    column.setFilterValue(newSelectedValues.size > 0 ? Array.from(newSelectedValues) : undefined)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
          {options?.map((option) => {
            const isSelected = selectedValues.has(option.value)
            return (
              <div
                key={option.value}
                className="flex items-center space-x-2 py-1"
              >
                <Checkbox
                  id={option.value}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    const newSelectedValues = new Set(selectedValues)
                    if (checked) {
                      newSelectedValues.add(option.value)
                    } else {
                      newSelectedValues.delete(option.value)
                    }
                    column.setFilterValue(newSelectedValues.size > 0 ? Array.from(newSelectedValues) : undefined)
                  }}
                />
                <label
                  htmlFor={option.value}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  {option.icon && <option.icon className="h-4 w-4" />}
                  {option.label}
                  {facets?.get(option.value) && (
                    <span className="text-xs text-muted-foreground">
                      ({facets.get(option.value)})
                    </span>
                  )}
                </label>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderFilterContent = () => {
    switch (type) {
      case "number":
        return <NumberFilter />
      case "date":
        return <DateFilter />
      case "select":
        return <SelectFilter />
      default:
        return <TextFilter />
    }
  }

  const isFiltered = column.getFilterValue() !== undefined
  const isSorted = column.getIsSorted()

  return (
    <div className="flex items-center space-x-1">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting()}
      >
        <span className="text-sm font-medium">{title}</span>
        {isSorted === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : isSorted === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isFiltered && "bg-accent"
            )}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* Sorting options */}
          <div className="px-3 py-2">
            <Label className="text-xs font-medium text-muted-foreground">Sort</Label>
            <div className="mt-1 space-y-1">
              <DropdownMenuItem 
                onClick={() => column.toggleSorting(false)}
                className="justify-start"
              >
                <ArrowUp className="mr-2 h-4 w-4" />
                Sort ascending
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => column.toggleSorting(true)}
                className="justify-start"
              >
                <ArrowDown className="mr-2 h-4 w-4" />
                Sort descending
              </DropdownMenuItem>
              {isSorted && (
                <DropdownMenuItem 
                  onClick={() => column.clearSorting()}
                  className="justify-start"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear sort
                </DropdownMenuItem>
              )}
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          {/* Filter content */}
          {renderFilterContent()}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}