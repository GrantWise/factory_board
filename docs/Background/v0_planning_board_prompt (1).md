# Manufacturing Planning Board - Modern SaaS Dashboard

## Project Overview
Create a modern SaaS dashboard for a digital manufacturing planning board that replicates traditional magnetic factory planning boards. This should be a comprehensive dashboard with collapsible sidebar navigation, analytics capabilities, and responsive design with dark mode support.

## Brand Colors (CRITICAL - Use These Exact Colors)
```css
/* Primary Blue */
--primary-blue: #00609C; /* Pantone 3015C */
--primary-blue-rgb: rgb(0, 96, 156);

/* Primary Grey */
--primary-grey: #B3B2B1; /* Pantone Cool Grey 5C */
--primary-grey-rgb: rgb(179, 178, 177);

/* Secondary Blue */
--secondary-blue: #C8DAF3; /* Pantone 2707U */
--secondary-blue-rgb: rgb(200, 218, 243);

/* Secondary Grey */
--secondary-grey: #DFE4E6; /* Pantone 7541U */
--secondary-grey-rgb: rgb(223, 228, 230);
```

## Core Dashboard Requirements

### Layout Structure
- **Collapsible Sidebar Navigation**: Left-side navigation that can expand/collapse
- **Main Content Area**: Kanban-style planning board with configurable columns
- **Analytics Cards Section**: Dashboard metrics above the planning board
- **Data Table**: Filterable table view of manufacturing orders
- **Mobile Responsive**: Works seamlessly on tablets and mobile devices
- **Dark Mode Support**: Toggle between light and dark themes

### Sidebar Navigation Features
- Company logo/branding area
- Navigation menu items:
  - Dashboard (current view)
  - Planning Board 
  - Orders Management
  - Work Centres
  - Analytics
  - Settings
- Collapse/expand functionality
- Active state indicators
- User profile section at bottom

### Planning Board Core Functionality
- **Configurable Columns**: Admin can define and rearrange work centre columns
- **Drag & Drop**: Manufacturing order cards move between columns
- **Column Management**: Add, remove, reorder work centre columns
- **Real-time Updates**: Interface ready for scanning system integration

## Manufacturing Order Data Structure
```json
{
  "orderNumber": "MO-2024-001",
  "stockCode": "WIDGET-A01",
  "description": "Premium Widget Assembly",
  "quantityToMake": 500,
  "quantityCompleted": 150,
  "currentStep": "Assembly",
  "workCentre": "ASSEMBLY-01",
  "status": "in-progress",
  "priority": "high",
  "dueDate": "2024-06-15",
  "startDate": "2024-06-01",
  "manufacturingSteps": [
    {"step": "Cutting", "workCentre": "CUT-01", "status": "complete"},
    {"step": "Assembly", "workCentre": "ASSEMBLY-01", "status": "in-progress"},
    {"step": "Quality Check", "workCentre": "QC-01", "status": "pending"},
    {"step": "Packaging", "workCentre": "PACK-01", "status": "pending"}
  ]
}
```

## Dashboard Analytics Cards
Include metrics cards showing:
- **Total Active Orders**: Current manufacturing orders in progress
- **Completion Rate**: Percentage of orders completed on time
- **Work Centre Utilization**: Percentage utilization across work centres
- **Daily Production**: Units produced today vs. target
- **Overdue Orders**: Count of orders past due date
- **Average Cycle Time**: Time from start to completion

## Manufacturing Order Card Design
Each card must display:
- **Order number** (prominent, top of card)
- **Stock code and description**
- **Progress bar** with percentage complete
- **Quantity completed / total quantity**
- **Current manufacturing step**
- **Priority indicator** (color-coded badge)
- **Due date** with urgency indicator
- **Status badge** (not started, in progress, complete, overdue)

### Card Color Coding
- **Not Started**: Light grey background with primary grey border
- **In Progress**: Primary blue background with white text
- **Complete**: Green background with white text
- **Overdue**: Red background with white text
- **High Priority**: Red accent border/indicator

## Work Centre Columns
- **Column Headers**: Work centre names with capacity indicators
- **Drag & Drop Zones**: Clear visual feedback for card placement
- **Column Configuration**: Settings to add/remove/reorder columns
- **Capacity Indicators**: Visual representation of current workload
- **Add New Column Button**: Easy way to create new work centres

## Data Table Requirements
- **Sortable Columns**: All data columns sortable
- **Advanced Filtering**: Filter by status, work centre, priority, date ranges
- **Search Functionality**: Global search across all order data
- **Export Capabilities**: Export filtered data to CSV/Excel
- **Pagination**: Handle large datasets efficiently
- **Column Visibility**: Show/hide columns as needed

## Technical Specifications

### Framework & Libraries
- **Next.js 14** with App Router
- **React** with TypeScript
- **Tailwind CSS** for styling (using custom brand colors)
- **shadcn/ui** components
- **Lucide React** for icons
- **Recharts** for analytics charts
- **React Beautiful DND** for drag and drop functionality

### Responsive Design Breakpoints
- **Mobile**: 320px - 768px (stacked layout, collapsible sidebar overlay)
- **Tablet**: 768px - 1024px (condensed layout, pinned sidebar)
- **Desktop**: 1024px+ (full layout with expanded sidebar)

### Dark Mode Implementation
- Use CSS custom properties for theme switching
- Maintain brand color integrity in both modes
- Ensure accessibility contrast ratios
- Toggle component in header/sidebar

## Sample Data Requirements
Create realistic sample data with:
- **8-12 manufacturing orders** in various stages
- **4-5 work centres**: "Cutting", "Assembly", "Quality Control", "Packaging", "Shipping"
- **Mixed priorities and due dates**
- **Realistic product descriptions and stock codes**
- **Various completion percentages**

## Accessibility Requirements
- **ARIA labels** for all interactive elements
- **Keyboard navigation** support
- **Screen reader** compatibility
- **High contrast** color combinations
- **Focus indicators** clearly visible
- **Semantic HTML** structure

## Performance Considerations
- **Optimized re-renders** during drag operations
- **Virtualization** for large datasets
- **Lazy loading** for heavy components
- **Efficient state management**
- **Minimal bundle size**

## Key Features to Implement First
1. **Sidebar with navigation and collapse functionality**
2. **Analytics cards section with sample metrics**
3. **Planning board with drag & drop between work centres**
4. **Column configuration (add/remove/reorder work centres)**
5. **Manufacturing order cards with complete information**
6. **Data table with filtering and search**
7. **Dark mode toggle**
8. **Mobile responsive layout**

## UI/UX Principles
- **Industrial Design Aesthetic**: Clean, professional, suitable for factory environment
- **Touch-Friendly**: Large touch targets for tablet use on factory floor
- **Information Hierarchy**: Critical information prominently displayed
- **Visual Consistency**: Consistent use of brand colors and spacing
- **Intuitive Navigation**: Clear user flows and logical organization

This dashboard should serve as the foundation for a production manufacturing system, with the interface designed to accommodate real-time scanning updates and database integration in future iterations.