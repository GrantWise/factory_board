# Planning Board

## **The Learning System Architecture:**

### **What Gets Automatically Recorded:**
```json
{
  "routingEvent": {
    "timestamp": "2024-06-01T14:30:22Z",
    "orderNumber": "MO-2024-001",
    "operation": "Drilling",
    "fromWorkCentre": "CUT-01", 
    "toWorkCentre": "CUT-03",
    "reason": "user_decision", // vs "scanner_progression"
    "userId": "john.doe",
    "queueDepthFrom": 5,
    "queueDepthTo": 2,
    "estimatedWaitTime": "45min"
  }
}
```

### **Scanner Integration Points:**
```json
{
  "scanEvent": {
    "timestamp": "2024-06-01T15:15:33Z",
    "orderNumber": "MO-2024-001",
    "workCentre": "CUT-03",
    "operation": "Drilling",
    "eventType": "job_start", // job_start, progress_update, job_complete
    "quantity": 50,
    "operator": "scanner_badge_123"
  }
}
```

## **What The System Learns (Automatically):**

### **1. Common Routing Patterns**
```
When Operation = "Drilling" AND Queue_CUT01 > 3:
├── 67% route to CUT-03 (avg wait: 12min)
├── 23% route to CUT-02 (avg wait: 35min)  
└── 10% wait for CUT-01 (avg wait: 67min)
```

### **2. Performance Metrics**
```
CUT-03 Performance for "Drilling":
├── Avg Cycle Time: 8.5min (vs planned 10min)
├── Setup Time: 3min average
├── Queue Efficiency: 85%
└── Common Follow-up: ASM-02 (78% of time)
```

### **3. Predictive Insights**
```
Smart Suggestions (appears after 3+ months of data):
┌─────────────────────────────┐
│ 💡 Scheduling Insight       │
│                             │
│ For Drilling operations:    │
│ • Route to CUT-03 when      │
│   CUT-01 queue > 2 jobs     │
│ • Saves avg 23min per job   │
│ • 89% success rate         │
└─────────────────────────────┘
```

## **UI Enhancement - Gentle Intelligence:**

### **Phase 1: Invisible Learning (0-3 months)**
- Everything works exactly as now
- System silently records all movements and scanner events
- Zero additional UI complexity

### **Phase 2: Gentle Suggestions (3+ months)**
Add subtle hints to the planning board:
```
┌─────────────────────┐
│ MO-2024-001         │
│ Widget - Drilling   │
│ 150/500 (30%)      │
│ ────────────────── │
│ 💡 CUT-03 typical   │ ← Gentle suggestion based on data
│ Due: 2 days         │
└─────────────────────┘
```

### **Phase 3: Smart Defaults (6+ months)**
- Pre-populate new orders with learned optimal routes
- But still allow complete override with drag & drop
- Show confidence levels: "87% of similar jobs go this route"

## **Backend Data Collection Strategy:**

### **Event Capture Points:**
1. **Drag & Drop Events**: Every manual routing decision
2. **Scanner Events**: Job start/progress/completion times
3. **Queue States**: Snapshot queue depths every 5 minutes
4. **Operator Actions**: Which operators prefer which routes

### **Analysis Algorithms:**
```python
# Simplified example
def analyze_routing_patterns():
    patterns = []
    
    for operation in operations:
        for queue_condition in queue_conditions:
            # Find most common routing decisions
            routes = get_routes_when(operation, queue_condition)
            success_rate = calculate_success_rate(routes)
            avg_time_saved = calculate_time_savings(routes)
            
            if success_rate > 0.8 and avg_time_saved > 10:
                patterns.append({
                    'operation': operation,
                    'condition': queue_condition,
                    'suggested_route': most_common_route,
                    'confidence': success_rate,
                    'benefit': avg_time_saved
                })
    
    return patterns
```

## **Progressive Intelligence Levels:**

### **Level 1: Data Collection** (Months 1-3)
- Silent recording only
- Build baseline understanding

### **Level 2: Pattern Recognition** (Months 4-6)
- Identify common routing alternatives
- Calculate time savings from decisions

### **Level 3: Gentle Suggestions** (Months 7+)
- Subtle visual hints on cards
- "Jobs like this usually go to..."

### **Level 4: Predictive Scheduling** (Year 2+)
- Auto-generate optimal schedules
- But always allow manual override
- Learn from overrides to improve

## **Key Principles:**
1. **Zero Burden**: Never ask users to input data
2. **Always Override**: Human decision always wins
3. **Show Confidence**: "73% confidence" not "You must do this"
4. **Learn from Mistakes**: When suggestions are ignored, understand why

The beauty is that this system gets smarter over time without anyone having to maintain it. The more they use it, the better it gets at helping them.