# **Planning Board**

## **Key UI Enhancements Needed:**

### **1. Hierarchical Work Centre Structure**
Instead of single columns, create **expandable work centre groups** that contain multiple machines/stations:

```
📁 CUTTING (3/10 Available)
  ├── CUT-01 (2 jobs) - Available
  ├── CUT-02 (1 job) - Busy  
  └── CUT-03 (0 jobs) - Maintenance

📁 ASSEMBLY (5/8 Available)
  ├── ASM-01 (3 jobs) - Busy
  ├── ASM-02 (2 jobs) - Available
  └── ASM-03 (0 jobs) - Available
```

### **2. Operation-Based Card Details**
Enhance manufacturing order cards to show:
- **Current Operation**: "Drilling - Hole Pattern A"
- **Capable Work Centres**: Visual indicators showing which machines can perform this operation
- **Alternative Routes**: Quick-access buttons for common rerouting options

### **3. Dynamic Routing Interface**

#### **Drag & Drop Flexibility:**
- **Cross-Column Drops**: Allow dragging between any compatible work centres
- **Visual Compatibility**: Show green/red zones during drag to indicate valid drop targets
- **Route Suggestions**: Highlight optimal alternative machines during drag operations

#### **Right-Click Context Menu:**
```
Right-click on order card:
├── Route to Alternative Machine
├── Split Order (partial quantities)
├── Priority Override
├── View Routing History
└── Mark for Supervisor Review
```

### **4. Routing Decision Support**

#### **Machine Capability Matrix:**
Add a toggle view showing which operations each machine can perform:
```
Operation      | CUT-01 | CUT-02 | CUT-03 | Notes
Rough Cut      |   ✓    |   ✓    |   ✓    | 
Precision Cut  |   ✓    |   ✗    |   ✓    | CUT-02 lacks precision tooling
Heavy Material |   ✗    |   ✓    |   ✓    | CUT-01 weight limit
```

#### **Real-Time Machine Status:**
```
Machine Cards showing:
├── Current Job & Time Remaining
├── Queue Length
├── Operator Assignment
├── Maintenance Status
└── Setup Time Required
```

### **5. Proposed UI Layout Changes:**

#### **Split-Pane Planning View:**
- **Left Panel**: Traditional kanban columns for workflow stages
- **Right Panel**: Detailed machine allocation view with drag-and-drop routing
- **Toggle Button**: Switch between "Process View" and "Resource View"

#### **Alternative Routes Sidebar:**
When you select an order, show:
```
Current Route: CUT-01 → ASM-02 → QC-01
Alternative Routes Available:
├── CUT-03 → ASM-02 → QC-01 (Est. 2h faster)
├── CUT-01 → ASM-01 → QC-02 (Current queue)
└── Express Route: CUT-03 → ASM-03 → QC-01 (Premium cost)
```

### **6. Enhanced Card Information:**
```
┌─────────────────────┐
│ MO-2024-001    [🔄] │ ← Reroute button
│ Widget Assembly     │
│ Current: Drilling   │
│ 150/500 (30%)      │
│ ────────────────── │
│ 🟢 CUT-03 Available │ ← Compatible machines
│ 🟡 CUT-01 Queue: 2  │
│ 🔴 CUT-02 Down     │
│ Due: 2 days        │
└─────────────────────┘
```

### **7. Workflow Improvements:**

#### **Quick Rerouting Modal:**
When dragging to an incompatible machine, show:
```
⚠️ Route Conflict Detected
Current Operation: "Precision Drilling"
Target Machine: CUT-02 (No precision capability)

Suggestions:
├── Route to CUT-03 (Available now)
├── Wait for CUT-01 (Available in 45min)
└── Split order: Send 200 units to CUT-03, rest to CUT-01
```

#### **Batch Rerouting:**
- Select multiple orders
- Apply routing changes to all selected
- Useful for shift changes or machine breakdowns

### **8. Data Structure Updates:**
```json
{
  "orderNumber": "MO-2024-001",
  "currentOperation": {
    "name": "Precision Drilling",
    "code": "DRILL-001",
    "compatibleMachines": ["CUT-01", "CUT-03"],
    "preferredMachine": "CUT-01",
    "currentMachine": "CUT-01"
  },
  "routingHistory": [
    {"timestamp": "2024-06-01T10:00", "from": "planned", "to": "CUT-01", "reason": "initial_assignment"},
    {"timestamp": "2024-06-01T14:30", "from": "CUT-01", "to": "CUT-03", "reason": "machine_breakdown", "user": "john.doe"}
  ],
  "alternativeRoutes": [
    {"machines": ["CUT-03", "ASM-02", "QC-01"], "estimatedTime": "8h", "cost": "standard"},
    {"machines": ["CUT-01", "ASM-03", "QC-01"], "estimatedTime": "10h", "cost": "standard"}
  ]
}
```