// These colors are based on Tailwind's color palette
// They are chosen to be accessible and work well in both light and dark modes
export const chartColors = {
  primary: {
    light: '#3b82f6', // blue-500
    dark: '#60a5fa', // blue-400
  },
  success: {
    light: '#10b981', // emerald-500
    dark: '#34d399', // emerald-400
  },
  warning: {
    light: '#f59e0b', // amber-500
    dark: '#fbbf24', // amber-400
  },
  error: {
    light: '#ef4444', // red-500
    dark: '#f87171', // red-400
  },
  info: {
    light: '#06b6d4', // cyan-500
    dark: '#22d3ee', // cyan-400
  },
  secondary: {
    light: '#8b5cf6', // violet-500
    dark: '#a78bfa', // violet-400
  },
}

export const getChartColors = (theme: string | undefined) => {
  const isDark = theme === 'dark'
  return [
    isDark ? chartColors.primary.dark : chartColors.primary.light,
    isDark ? chartColors.success.dark : chartColors.success.light,
    isDark ? chartColors.warning.dark : chartColors.warning.light,
    isDark ? chartColors.error.dark : chartColors.error.light,
    isDark ? chartColors.info.dark : chartColors.info.light,
    isDark ? chartColors.secondary.dark : chartColors.secondary.light,
  ]
}

export const getChartTheme = (theme: string | undefined) => {
  const isDark = theme === 'dark'
  return {
    text: {
      fill: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
    },
    grid: {
      stroke: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    tooltip: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderColor: isDark ? '#374151' : '#e5e7eb',
    },
  }
} 