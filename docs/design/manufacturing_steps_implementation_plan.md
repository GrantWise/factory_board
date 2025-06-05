# Manufacturing Steps & Visual Characteristics Implementation Plan

## Executive Summary

This implementation plan extends the existing Manufacturing Planning Board with **part-level manufacturing steps management** and **visual job characteristics**, while maintaining the core principle of "record don't control" and progressive enhancement. The plan builds on the solid architectural foundation outlined in the existing SRS and PRD documents.

## Core Philosophy

- **Keep Simple Things Simple**: Default to clean interface, add complexity only when needed
- **Part-Level Route Management**: Define operations once per part, reuse across orders
- **Progressive Enhancement**: Features appear only when configured and valuable
- **Visual Context**: Color coding provides immediate visual understanding
- **Record Don't Control**: System aids decisions but never forces workflows

---

## Architecture Overview

### New Data Models

Building on the existing `manufacturing_orders` and `manufacturing_steps` tables:

```typescript
// New: Part Routes (reusable operation sequences)
interface PartRoute {
  id: string;
  partNumber: string;
  operations: Operation[];
  source: "manual" | "learned" | "suggested";
  confidence?: number; // For learned routes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Operation {
  sequenceNumber: number;
  name: string; // "Cut", "Drill", "Deburr", "Inspect"
  estimatedDurationMinutes?: number;
  compatibleWorkCentres?: string[]; // Optional constraints
}

// New: Visual Job Characteristics
interface JobCharacteristic {
  id: string;
  orderNumber: string;
  type: "customer_order" | "allergen" | "priority" | "material" | "custom";
  value: string;
  color: string; // Hex color
  displayName?: string;
  isSystemGenerated: boolean;
}

// Extended: Manufacturing Order
interface ManufacturingOrder {
  // ... existing fields
  partNumber?: string; // Link to part routes
  currentOperationName?: string; // From active route
  routeSource?: "manual" | "inherited" | "learned";
  characteristics: JobCharacteristic[];
}
```

### Database Schema Changes

```sql
-- New: Part Routes table
CREATE TABLE part_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    source ENUM('manual', 'learned', 'suggested') DEFAULT 'manual',
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_number, is_active) -- Only one active route per part
);

-- New: Route Operations table  
CREATE TABLE route_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    estimated_duration_minutes INTEGER,
    compatible_work_centres JSON, -- Array of work centre IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES part_routes(id) ON DELETE CASCADE,
    UNIQUE(route_id, sequence_number)
);

-- New: Job Characteristics table
CREATE TABLE job_characteristics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    type ENUM('customer_order', 'allergen', 'priority', 'material', 'custom') NOT NULL,
    value VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL, -- Hex color #RRGGBB
    display_name VARCHAR(100),
    is_system_generated BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE
);

-- New: User Settings table for visual characteristics
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, setting_key)
);

-- Extend existing manufacturing_orders table
ALTER TABLE manufacturing_orders 
ADD COLUMN part_number VARCHAR(50),
ADD COLUMN current_operation_name VARCHAR(100),
ADD COLUMN route_source ENUM('manual', 'inherited', 'learned') DEFAULT 'manual';

-- Update existing manufacturing_steps to link with routes
ALTER TABLE manufacturing_steps 
ADD COLUMN route_operation_id INTEGER,
ADD FOREIGN KEY (route_operation_id) REFERENCES route_operations(id);
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

#### 1.1 Backend Foundation
- Create new database tables and migrations
- Implement Part Routes API endpoints
- Extend Manufacturing Orders API for part linking
- Add Job Characteristics API endpoints
- Implement User Settings API

**API Endpoints:**
```
GET    /api/part-routes                    # List part routes
POST   /api/part-routes                    # Create route
GET    /api/part-routes/:partNumber        # Get route for part
PUT    /api/part-routes/:id               # Update route
DELETE /api/part-routes/:id               # Deactivate route

GET    /api/orders/:id/characteristics     # Get job characteristics
POST   /api/orders/:id/characteristics     # Add characteristic
DELETE /api/characteristics/:id           # Remove characteristic

GET    /api/user-settings                 # Get user settings
PUT    /api/user-settings/:key           # Update setting
```

#### 1.2 Core Data Services
- Part route inheritance logic for new orders
- Operation progression tracking
- Visual characteristics management
- Settings-driven feature toggles

### Phase 2: Basic UI Integration (Weeks 3-4)

#### 2.1 Enhanced Job Cards
Update job cards to show operation context when routes exist:

```tsx
// Enhanced OrderCard component
interface OrderCardProps {
  order: ManufacturingOrder;
  isDragging?: boolean;
  showCharacteristics?: boolean; // From user settings
}

const OrderCard = ({ order, isDragging, showCharacteristics }) => {
  const currentOperation = getCurrentOperation(order);
  const nextOperation = getNextOperation(order);
  const characteristics = order.characteristics || [];
  
  return (
    <Card className={`
      ${isDragging ? 'opacity-90 rotate-1 shadow-lg' : 'shadow-sm'}
      ${characteristics.length > 0 ? 'border-l-4' : ''}
    `}
    style={{
      borderLeftColor: characteristics[0]?.color
    }}>
      {/* Color stripe for primary characteristic */}
      {characteristics[0] && (
        <div 
          className="h-1 w-full rounded-t-md"
          style={{ backgroundColor: characteristics[0].color }}
        />
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <span className="font-semibold">{order.orderNumber}</span>
          <PriorityBadge priority={order.priority} />
        </div>
        <p className="text-sm text-gray-600">{order.stockCode}</p>
      </CardHeader>
      
      <CardContent className="space-y-2">
        <p className="text-sm">{order.description}</p>
        
        {/* Operation info (only when route exists) */}
        {currentOperation && (
          <div className="text-sm bg-blue-50 p-2 rounded">
            <span className="font-medium">→ {currentOperation.name}</span>
            {nextOperation && (
              <span className="text-gray-500 ml-2">
                (Next: {nextOperation.name})
              </span>
            )}
          </div>
        )}
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>{order.quantityCompleted}/{order.quantityToMake}</span>
          <span>Due: {formatDate(order.dueDate)}</span>
        </div>
        
        {/* Intelligent routing suggestion (future) */}
        {suggestedWorkCentre && (
          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            💡 {suggestedWorkCentre} typical ({confidence}%)
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

#### 2.2 Settings Panel
Create user settings interface for visual characteristics:

```tsx
const VisualCharacteristicsSettings = () => {
  const [enabledCharacteristics, setEnabledCharacteristics] = useState([]);
  
  return (
    <SettingsSection title="Visual Groupings">
      <div className="space-y-4">
        <Toggle 
          checked={enabledCharacteristics.includes('customer_order')}
          onCheckedChange={(checked) => 
            handleCharacteristicToggle('customer_order', checked)
          }
        >
          Customer Reference Field
        </Toggle>
        
        <Toggle 
          checked={enabledCharacteristics.includes('priority')}
          onCheckedChange={(checked) => 
            handleCharacteristicToggle('priority', checked)
          }
        >
          Priority Indicators
        </Toggle>
        
        <div className="mt-4">
          <Label>Custom Fields</Label>
          <Input placeholder="Custom characteristic name" />
          <Button size="sm">Add Custom Field</Button>
        </div>
        
        <div className="mt-4">
          <Label>Color Assignment</Label>
          <RadioGroup defaultValue="automatic">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="automatic" />
              <Label>Automatic (system assigns)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" />
              <Label>Manual (I'll choose colors)</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </SettingsSection>
  );
};
```

### Phase 3: Route Management (Weeks 5-6)

#### 3.1 Part Route Creation
Optional route definition when creating orders:

```tsx
const OrderCreationForm = () => {
  const [showRouteCreation, setShowRouteCreation] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  
  return (
    <Form>
      {/* Existing order fields */}
      
      {/* Part route section - only shown when no route exists */}
      {!existingRoute && (
        <FormField>
          <div className="flex items-center space-x-2">
            <Checkbox 
              checked={showRouteCreation}
              onCheckedChange={setShowRouteCreation}
            />
            <Label>Define operations for {partNumber}</Label>
          </div>
          
          {showRouteCreation && (
            <RouteBuilder 
              operations={operations}
              onOperationsChange={setOperations}
              workCentres={workCentres}
            />
          )}
        </FormField>
      )}
      
      {/* Suggested routes from similar parts */}
      {suggestedRoutes.length > 0 && (
        <div className="bg-blue-50 p-3 rounded">
          <Label>Suggested routes from similar parts:</Label>
          {suggestedRoutes.map(route => (
            <Button 
              key={route.id}
              variant="outline" 
              size="sm"
              onClick={() => adoptRoute(route)}
            >
              Use route from {route.partNumber}
            </Button>
          ))}
        </div>
      )}
    </Form>
  );
};
```

#### 3.2 Route Builder Component
Simple interface for defining operation sequences:

```tsx
const RouteBuilder = ({ operations, onOperationsChange, workCentres }) => {
  const addOperation = () => {
    const newOp = {
      sequenceNumber: operations.length + 1,
      name: '',
      estimatedDurationMinutes: undefined,
      compatibleWorkCentres: []
    };
    onOperationsChange([...operations, newOp]);
  };
  
  return (
    <div className="space-y-3">
      {operations.map((op, index) => (
        <div key={index} className="flex items-center space-x-2 p-2 border rounded">
          <Badge variant="secondary">{index + 1}</Badge>
          <Input 
            placeholder="Operation name (e.g., Cut, Drill)"
            value={op.name}
            onChange={(e) => updateOperation(index, 'name', e.target.value)}
          />
          <Input 
            type="number"
            placeholder="Duration (min)"
            value={op.estimatedDurationMinutes || ''}
            onChange={(e) => updateOperation(index, 'estimatedDurationMinutes', 
              e.target.value ? parseInt(e.target.value) : undefined)}
          />
          <MultiSelect
            placeholder="Compatible work centres"
            options={workCentres}
            value={op.compatibleWorkCentres}
            onChange={(value) => updateOperation(index, 'compatibleWorkCentres', value)}
          />
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => removeOperation(index)}
          >
            ×
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={addOperation}>
        + Add Operation
      </Button>
    </div>
  );
};
```

### Phase 4: Intelligent Integration (Weeks 7-8)

#### 4.1 Learning System Integration
Extend existing audit logging to capture route-related decisions:

```typescript
// Enhanced audit logging for intelligent routing
interface RouteEvent {
  timestamp: string;
  orderNumber: string;
  partNumber: string;
  operation: string;
  fromWorkCentre: string;
  toWorkCentre: string;
  reason: "user_decision" | "route_following" | "route_override";
  expectedWorkCentre?: string; // From route definition
  routeSource: "manual" | "inherited" | "learned";
  userId: string;
  queueDepthFrom: number;
  queueDepthTo: number;
}
```

#### 4.2 Route Learning Algorithm
Automatically suggest routes based on historical patterns:

```typescript
class RouteIntelligenceService {
  async suggestRouteForPart(partNumber: string): Promise<PartRoute | null> {
    // Find similar parts by name patterns
    const similarParts = await this.findSimilarParts(partNumber);
    
    // Analyze historical movement patterns
    const commonRoutes = await this.analyzeMovementPatterns(similarParts);
    
    // Generate confidence-weighted suggestion
    if (commonRoutes.length > 0 && commonRoutes[0].confidence > 0.7) {
      return {
        partNumber,
        operations: commonRoutes[0].operations,
        source: "learned",
        confidence: commonRoutes[0].confidence
      };
    }
    
    return null;
  }
  
  async updateRouteConfidence(routeId: string, followedCorrectly: boolean) {
    // Update confidence based on whether users follow suggestions
    // This feeds back into the learning system
  }
}
```

#### 4.3 Smart Suggestions in UI
Show gentle routing suggestions based on learned patterns:

```tsx
const SmartSuggestionBanner = ({ order, suggestedWorkCentre, confidence }) => {
  if (!suggestedWorkCentre || confidence < 0.6) return null;
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
      <div className="flex items-center space-x-2">
        <InfoIcon className="h-4 w-4 text-blue-600" />
        <span className="text-sm text-blue-800">
          Based on similar jobs, {suggestedWorkCentre} is typically next 
          ({Math.round(confidence * 100)}% confidence)
        </span>
        <Button variant="link" size="sm">
          Why this suggestion?
        </Button>
      </div>
    </div>
  );
};
```

### Phase 5: Visual Characteristics (Weeks 9-10)

#### 5.1 Automatic Characteristic Detection
System detects potential groupings from existing data:

```typescript
class CharacteristicDetectionService {
  async suggestCharacteristics(orders: ManufacturingOrder[]): Promise<CharacteristicSuggestion[]> {
    const suggestions = [];
    
    // Detect customer order patterns
    const customerRefs = this.extractCustomerReferences(orders);
    if (customerRefs.length > 1) {
      suggestions.push({
        type: 'customer_order',
        description: `Found ${customerRefs.length} customer orders`,
        value: 'Create customer order grouping?',
        orders: this.getOrdersWithCustomerRefs(orders)
      });
    }
    
    // Detect part family patterns
    const partFamilies = this.groupByPartFamily(orders);
    Object.entries(partFamilies).forEach(([family, familyOrders]) => {
      if (familyOrders.length > 2) {
        suggestions.push({
          type: 'part_family',
          description: `${familyOrders.length} orders for ${family} family`,
          value: family,
          orders: familyOrders
        });
      }
    });
    
    return suggestions;
  }
}
```

#### 5.2 Color Management System
Smart color assignment that maintains readability:

```typescript
class ColorAssignmentService {
  private colorPalette = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16'  // Lime
  ];
  
  assignColors(characteristics: JobCharacteristic[]): Map<string, string> {
    const assignments = new Map();
    let colorIndex = 0;
    
    // Group by type for consistent coloring
    const grouped = this.groupBy(characteristics, 'type');
    
    Object.entries(grouped).forEach(([type, items]) => {
      items.forEach(item => {
        if (!assignments.has(item.value)) {
          assignments.set(item.value, this.colorPalette[colorIndex % this.colorPalette.length]);
          colorIndex++;
        }
      });
    });
    
    return assignments;
  }
}
```

---

## Enhanced User Interface

### Updated Planning Board Layout

```tsx
const EnhancedPlanningBoard = () => {
  const { enabledCharacteristics } = useUserSettings();
  const { orders, workCentres } = usePlanningBoardData();
  
  return (
    <div className="planning-board">
      {/* Characteristic Legend (when enabled) */}
      {enabledCharacteristics.length > 0 && (
        <CharacteristicLegend characteristics={getUniqueCharacteristics(orders)} />
      )}
      
      {/* Work Centre Columns */}
      <div className="flex gap-4 overflow-x-auto">
        {workCentres.map(workCentre => (
          <WorkCentreColumn 
            key={workCentre.id}
            workCentre={workCentre}
            orders={getOrdersForWorkCentre(orders, workCentre.id)}
            showCharacteristics={enabledCharacteristics.length > 0}
            onOrderMove={handleOrderMove}
          />
        ))}
      </div>
      
      {/* Smart Suggestions Panel (when available) */}
      <SmartSuggestionsPanel suggestions={smartSuggestions} />
    </div>
  );
};
```

### Characteristic Legend Component

```tsx
const CharacteristicLegend = ({ characteristics }) => {
  const grouped = groupBy(characteristics, 'type');
  
  return (
    <div className="bg-gray-50 p-3 rounded-md mb-4">
      <h4 className="text-sm font-medium mb-2">Color Coding</h4>
      <div className="flex flex-wrap gap-4">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-600 mr-2">{formatTypeName(type)}:</span>
            {items.map(item => (
              <Badge 
                key={item.value}
                variant="secondary"
                style={{ backgroundColor: item.color, color: 'white' }}
              >
                {item.displayName || item.value}
              </Badge>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Data Migration Strategy

### Migration Scripts

```sql
-- Migration 001: Add part route support
-- (Create tables as defined above)

-- Migration 002: Populate existing orders with route inheritance
UPDATE manufacturing_orders 
SET part_number = stock_code 
WHERE part_number IS NULL;

-- Migration 003: Create default routes from existing step patterns
INSERT INTO part_routes (part_number, source)
SELECT DISTINCT part_number, 'learned'
FROM manufacturing_orders
WHERE part_number IS NOT NULL;

-- Migration 004: Populate route operations from historical patterns
INSERT INTO route_operations (route_id, sequence_number, operation_name)
SELECT pr.id, ms.step_number, ms.operation_name
FROM part_routes pr
JOIN manufacturing_orders mo ON mo.part_number = pr.part_number
JOIN manufacturing_steps ms ON ms.order_id = mo.id
WHERE pr.source = 'learned'
GROUP BY pr.id, ms.step_number, ms.operation_name
ORDER BY pr.id, ms.step_number;
```

### Backward Compatibility

- Existing orders continue working without routes
- New route features are purely additive
- All route functionality is optional
- Existing APIs remain unchanged

---

## Testing Strategy

### Unit Tests
- Route inheritance logic
- Color assignment algorithms
- Characteristic detection
- Operation progression tracking

### Integration Tests
- Order creation with routes
- Route suggestion accuracy
- Visual characteristic assignment
- Settings persistence

### User Acceptance Tests
- Foreman workflow with new features
- Progressive feature adoption
- Settings configuration
- Performance with large datasets

---

## Performance Considerations

### Database Optimization
- Index on `part_routes.part_number`
- Index on `job_characteristics.order_id`
- Composite index on `route_operations(route_id, sequence_number)`

### Frontend Optimization
- Lazy load route data only when needed
- Memoize color calculations
- Virtual scrolling for large characteristic lists
- Debounced settings updates

### Caching Strategy
- Cache part routes for active parts
- Cache color assignments in memory
- Cache user settings in localStorage
- Invalidate cache on route updates

---

## Rollout Plan

### Week 1-2: Foundation
- Database migrations
- Basic API endpoints
- Core business logic

### Week 3-4: Basic UI
- Enhanced job cards
- Settings panel
- Basic route display

### Week 5-6: Route Management
- Route creation interface
- Route inheritance logic
- Operation progression

### Week 7-8: Intelligence Integration
- Learning algorithm implementation
- Smart suggestions
- Confidence scoring

### Week 9-10: Visual Characteristics
- Characteristic detection
- Color management
- Legend and grouping

### Week 11-12: Polish & Testing
- Performance optimization
- User testing
- Bug fixes and refinements

---

## Success Metrics

### Adoption Metrics
- Percentage of parts with defined routes
- User setting configuration rates
- Feature usage tracking

### Workflow Metrics
- Reduction in "lost" orders
- Improved operation progression accuracy
- Faster job card scanning and location

### Intelligence Metrics
- Route suggestion accuracy
- User acceptance of suggestions
- Learning system improvement over time

---

## Risk Mitigation

### Technical Risks
- **Database performance**: Mitigated by proper indexing and incremental loading
- **UI complexity**: Mitigated by progressive disclosure and user settings
- **Learning accuracy**: Mitigated by confidence scoring and human override

### User Adoption Risks
- **Feature overwhelm**: Mitigated by default-off approach and gradual introduction
- **Workflow disruption**: Mitigated by backward compatibility and optional features
- **Training requirements**: Mitigated by intuitive design and contextual help

---

## Future Enhancements

### Phase 6: Advanced Intelligence (Month 3-6)
- Predictive routing based on queue depths
- Machine learning for operation time estimation
- Cross-part pattern recognition

### Phase 7: Multi-facility Support (Month 6-12)
- Part route sharing across facilities
- Federated learning systems
- Centralized characteristic management

### Phase 8: ERP Integration (Month 12+)
- Automatic route import from ERP
- Bidirectional characteristic sync
- Advanced analytics and reporting

---

This implementation plan maintains the elegance and simplicity of your current system while adding powerful new capabilities that grow with your users' needs. The part-level route management and visual characteristics provide immediate value while building the foundation for intelligent manufacturing that learns and improves over time.