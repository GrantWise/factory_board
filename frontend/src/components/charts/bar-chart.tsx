import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { getChartColors, getChartTheme } from '@/lib/chart-theme'

interface DataPoint {
  name: string
  [key: string]: any
}

interface BarChartProps {
  data: DataPoint[]
  dataKeys: string[]
  colors?: string[]
  height?: number
  className?: string
  showGrid?: boolean
  showLegend?: boolean
  yAxisLabel?: string
  xAxisLabel?: string
  tooltipFormatter?: (value: number) => string
  barSize?: number
}

export function BarChart({
  data,
  dataKeys,
  colors,
  height = 300,
  className,
  showGrid = true,
  showLegend = true,
  yAxisLabel,
  xAxisLabel,
  tooltipFormatter = (value) => value.toString(),
  barSize = 20,
}: BarChartProps) {
  const { theme } = useTheme()
  const chartTheme = getChartTheme(theme)
  const defaultColors = getChartColors(theme)
  const chartColors = colors || defaultColors

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
            />
          )}
          <XAxis
            dataKey="name"
            stroke={chartTheme.text.fill}
            label={xAxisLabel ? { value: xAxisLabel, position: 'bottom', fill: chartTheme.text.fill } : undefined}
          />
          <YAxis
            stroke={chartTheme.text.fill}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'left', fill: chartTheme.text.fill } : undefined}
          />
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
              formatter={(value) => (
                <span style={{ color: chartTheme.text.fill }}>
                  {value}
                </span>
              )}
            />
          )}
          {dataKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={chartColors[index % chartColors.length]}
              radius={[4, 4, 0, 0]}
              barSize={barSize}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
} 