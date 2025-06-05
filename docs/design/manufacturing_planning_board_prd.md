# Manufacturing Planning Board - Product Requirements Document

## 1. Elevator Pitch

The Manufacturing Planning Board is a digital replacement for traditional whiteboards and Excel spreadsheets used to manage job flow in machine shops and fabrication facilities. It provides real-time visibility of all manufacturing orders across work centers through an intuitive drag-and-drop interface, enabling foremen to instantly answer "where's my order?" and efficiently manage priorities without administrative burden. The system integrates with existing ERP systems and uses RF scanner technology to automatically update job progress, eliminating lost jobs and reducing expediting chaos.

## 2. Who is this app for

### Primary Users
- **Production Foremen/Supervisors**: Main users who manage daily job flow, assign work to machines, and handle priority changes
- **Production Planners**: Create and schedule manufacturing orders, set initial priorities and due dates
- **Machine Operators**: Use RF scanners to update job progress and move work between operations

### Target Environment
- **Small to medium machine shops** (5-50 machines)
- **Fabrication facilities** with sequential operations (cutting, turning, milling, welding, etc.)
- **Make-to-order manufacturers** transitioning from manual planning methods
- **Shops with basic ERP systems** that lack real-time shop floor visibility

### Current Pain Points Being Solved
- Jobs getting lost or forgotten in queues for days
- Foremen spending excessive time walking around looking for specific orders
- Inability to quickly assess impact of priority changes
- Poor shift handover communication
- Excessive queuing time between operations
- Manual job tracking creating administrative burden

## 3. Functional Requirements

### Core Features (MVP)
1. **Digital Planning Board**
   - Kanban-style interface with columns representing work centers/machines
   - Drag-and-drop job cards between work centers
   - Real-time visual status of all manufacturing orders

2. **Manufacturing Order Management**
   - Import jobs from ERP via CSV/Excel files
   - Display essential job information: Job#, Part#, Description, Quantity, Due Date
   - Flexible operation handling: predefined routing OR foreman-defined flow
   - Job status tracking: Not Started, In Progress, Complete, Waiting for Material, Waiting for Tooling
   - Priority levels: Normal, Priority, Emergency

3. **Work Center Configuration**
   - Shop-specific work center setup (Cut Saw, Lathe 1, Lathe 2, Mill, etc.)
   - Flexible work center arrangement and reordering
   - Visual queue management for each work center

4. **RF Scanner Integration**
   - Scan to start operations (Not Started → In Progress)
   - Scan to complete operations (In Progress → Complete)
   - Scan to move jobs between work centers
   - Automatic board updates from scanner events

5. **Flexible Operation Management**
   - Support jobs with predefined operations from ERP
   - Support jobs with minimal routing data (foreman determines flow)
   - Handle single-operation jobs that actually require multiple steps
   - Allow ad-hoc operation creation during job execution
   - Visual indicators show job progress regardless of operation complexity

6. **Job Documentation & Barcode Integration**
   - Print job packs with barcodes directly from the system
   - Barcode scanning for job identification and progress updates
   - Bridge between digital planning and physical job travelers

7. **Due Date Management**
   - Visual overdue alerts on job cards
   - Due date conflict warnings when priorities change
   - Simple delivery promise capability based on current queue status

8. **Central Display Support**
   - Large screen/TV display mode for shop floor visibility
   - Show current priorities and urgent jobs
   - Operator-friendly view of work queues and next jobs

9. **Smart Conflict Management**
   - Visual warnings when jobs are moved before operations complete
   - "Trust the foreman" approach - allow moves with feedback
   - Quick correction options for mismatched states

10. **Passive Learning System**
    - Automatically record all job movements between work centers
    - Track timing data for queue times and operation durations
    - Capture routing decisions made by foremen (no user input required)
    - Build historical database of actual vs. planned routing patterns
    - Foundation for future intelligent suggestions and ERP data improvement

11. **Multi-User Access**
    - Role-based permissions (Planner, Foreman, Operator)
    - Real-time updates across multiple users
    - Basic user authentication

### Future Features (Post-MVP)
- **Resource Capacity Management**: Machine capacity limits, operator skills, maintenance schedules
- **Material Requirements Integration**: Inventory visibility and material shortage alerts
- **Advanced Due Date Management**: Delivery promise system with capacity-based calculations
- **Intelligent Routing Suggestions**: Gentle hints based on historical patterns ("Jobs like this usually go to CUT-03")
- **ERP Data Enhancement**: Use captured routing data to improve ERP master data accuracy
- **Predictive Analytics**: Queue time predictions and bottleneck identification
- **Route Optimization**: Confidence-based suggestions ("87% of similar jobs follow this route")
- ERP API integration for automatic job import/export
- Tablet interface for mobile foreman access
- Partial quantity tracking and job splitting
- Operation time capture for costing
- Offline capability
- Advanced analytics and reporting

## 4. User Stories

### Planner Stories
- As a planner, I want to import manufacturing orders from our ERP so I can populate the planning board without manual data entry
- As a planner, I want to set initial work center assignments and priorities so jobs start in the right queues
- As a planner, I want to view the current shop status so I can make realistic delivery promises

### Foreman Stories
- As a foreman, I want to see all jobs and their locations on one screen so I can quickly answer "where's my order?"
- As a foreman, I want to drag jobs between work centers so I can balance workload and manage priorities
- As a foreman, I want to manage jobs regardless of whether operations are predefined or unknown
- As a foreman, I want to handle single-operation jobs that actually need multiple steps without system restrictions
- As a foreman, I want visual indicators when something doesn't match so I can investigate potential issues
- As a foreman, I want to change job priorities instantly so I can respond to urgent customer requests
- As a foreman, I want to see what's queued at each machine so I can optimize job flow
- As a foreman, I want automatic updates when operators scan jobs so I have real-time status

### Operator Stories
- As an operator, I want to scan when I start a job so the system knows I'm working on it
- As an operator, I want to scan when I complete a job so it moves to the next operation automatically
- As an operator, I want to see what jobs are urgent so I can prioritize my work
- As an operator, I want the system to guide me to the next work center when I complete an operation

## 5. User Interface

### Planning Board Layout
- **Header**: Company branding, user info, refresh status, priority filters
- **Work Center Columns**: Configurable columns representing machines/work centers
- **Job Cards**: Visual cards showing job information within each column
- **Side Panel**: Job details, filters, and configuration options

### Job Card Design (Flexible Operations)
```
Scenario A - Job with Known Operations:
┌─────────────────────┐
│ MO-2024-001    [🔥] │ ← Priority indicator
│ BRACKET-A01         │ ← Part number
│ Widget Bracket      │ ← Description  
│ Qty: 100           │ ← Quantity
│ ────────────────── │
│ TURNING [●]        │ ← Current operation & status
│ Step 2 of 4        │ ← Progress indicator
│ Due: 2024-06-15    │ ← Due date
└─────────────────────┘

Scenario B - Job with Unknown Operations:
┌─────────────────────┐
│ MO-2024-002    [🔥] │ ← Priority indicator
│ HOUSING-B12         │ ← Part number
│ Pump Housing        │ ← Description  
│ Qty: 50            │ ← Quantity
│ ────────────────── │
│ IN PROGRESS [●]    │ ← Simple job status
│ @ LATHE-1          │ ← Current location
│ Due: 2024-06-20    │ ← Due date
└─────────────────────┘
```

### Visual Status Indicators
- **Job Status**: Color-coded indicators (Grey=Not Started, Blue=In Progress, Green=Complete, Orange=Waiting for Material, Purple=Waiting for Tooling)
- **Priority Levels**: Fire icon (Emergency), Up arrow (Priority), No icon (Normal)
- **Location Mismatch**: Warning icon when physical location doesn't match operation flow
- **Overdue Jobs**: Red highlighting for jobs past due date

### Work Center Columns
- **Header**: Work center name and current job count
- **Capacity Indicator**: Visual representation of queue depth
- **Drop Zones**: Clear visual feedback during drag operations
- **Configuration**: Settings menu for each work center

### Scanner Interface
- **Simple scan modes**: Start Operation, Complete Operation, Move Job
- **Visual feedback**: Success/error messages after each scan
- **Offline capability**: Queue scans when network unavailable (future)

### Mobile Considerations
- **Touch-friendly**: Large touch targets for tablet use
- **Responsive design**: Adapts to different screen sizes
- **Simplified navigation**: Essential features accessible on mobile

### Accessibility Features
- **High contrast**: Clear visibility in shop environment
- **Large text**: Readable from distance
- **Keyboard navigation**: Full functionality without mouse
- **Screen reader support**: ARIA labels and semantic markup

## Success Metrics

**Primary Success Indicator**: Foreman can answer "where's my order?" in under 10 seconds instead of 10+ minutes of searching.

**Additional Metrics**:
- Reduced time spent by foremen walking the shop floor looking for jobs
- Faster response to priority changes and expediting requests
- Improved shift handover efficiency
- Decreased number of "lost" jobs sitting in queues
- Better visibility into queue depths and bottlenecks
- **Data Collection Quality**: Capture rate of job movements and timing data for future analytics

**Technical Metrics**:
- System uptime > 99% during production hours
- Page load times < 2 seconds
- Scanner response time < 1 second
- Multi-user updates propagated within 5 seconds