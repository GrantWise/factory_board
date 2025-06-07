import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { getChartColors, getChartTheme } from '@/lib/chart-theme'

interface DataPoint {
  name: string
  value: number
}

interface PieChartProps {
  data: DataPoint[]
  colors?: string[]
  height?: number
  className?: string
  showLegend?: boolean
  tooltipFormatter?: (value: number) => string
  innerRadius?: number
  outerRadius?: number
}

export function PieChart({
  data,
  colors,
  height = 300,
  className,
  showLegend = true,
  tooltipFormatter = (value) => value.toString(),
  innerRadius = 0,
  outerRadius = 80,
}: PieChartProps) {
  const { theme } = useTheme()
  const chartTheme = getChartTheme(theme)
  const defaultColors = getChartColors(theme)
  const chartColors = colors || defaultColors

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={chartColors[index % chartColors.length]}
                stroke={chartTheme.tooltip.backgroundColor}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: chartTheme.tooltip.backgroundColor,
              border: `1px solid ${chartTheme.tooltip.borderColor}`,
              borderRadius: '0.375rem',
            }}
            formatter={(value: number) => tooltipFormatter(value)}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span style={{ color: chartTheme.text.fill }}>
                  {value}
                </span>
              )}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
} 