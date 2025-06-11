# Manufacturing Steps & Visual Characteristics - Practical Implementation Plan

## Executive Summary

This plan implements **visual job characteristics for grouping** and **part route templates** while preserving the elegant simplicity of our current planning board. We prioritize **visual grouping through job characteristics** first, then **part route management** with historical learning capabilities.

## Core Philosophy & Approach

- **Visual Grouping First**: Job characteristics with color coding for instant visual understanding
- **User-Controlled Display**: Users choose which 1-2 characteristics to show, not automatic
- **Clean Card Design**: Primary color with optional secondary color band, no clutter
- **Part Route Inheritance**: Orders automatically inherit operations from part templates
- **Manual First, Learn Later**: Collect data through manual route creation, then add intelligence

---

## Current State Analysis

### Identified Issues

1. **Hardcoded Current Operations**: Static strings like "Drilling", "Assembly" in job cards
2. **Disconnected Step Tracking**: Manufacturing steps exist but don't drive current operation display
3. **No Visual Differentiation**: All job cards look identical regardless of operation type
4. **Static Sample Data**: Hardcoded operations in test data and components
5. **Manual Status Management**: No automatic progression from step completion

### Files Requiring Updates

- `frontend/src/components/order-card.tsx` - Replace hardcoded current_operation
- `frontend/src/components/planning-board.tsx` - Add visual characteristics
- `frontend/src/components/orders-table.tsx` - Dynamic current step calculation
- `frontend/src/types/manufacturing.ts` - Extend interfaces
- `backend/src/models/ManufacturingOrder.js` - Add business logic methods
- `frontend/src/data/sample-data.ts` - Remove hardcoded operations

---

## Implementation Phases

### Phase 1: Job Characteristics & Visual Grouping (Week 1-2)

#### 1.1 Backend: Job Characteristics Data Model

**Objective**: Create the foundational data model for job characteristics and visual grouping.

**Job Characteristics Schema**:
```sql
-- New: Job Characteristics table
CREATE TABLE job_characteristics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    type ENUM('customer_order', 'customer', 'material', 'priority', 'part_family', 'custom') NOT NULL,
    value VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL, -- Hex color #RRGGBB
    display_name VARCHAR(100),
    is_system_generated BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE
);

-- User Settings for characteristic display preferences
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
```

**JobCharacteristic Model**:
```javascript
// backend/src/models/JobCharacteristic.js

class JobCharacteristic extends Model {
  static associate(models) {
    JobCharacteristic.belongsTo(models.ManufacturingOrder, {
      foreignKey: 'order_id',
      as: 'order'
    });
  }
  
  static async detectCharacteristicsForOrder(order) {
    const characteristics = [];
    
    // Detect customer order grouping from description/reference
    const customerOrderMatch = order.description.match(/SO[0-9]+|PO[0-9]+|REF[0-9]+/i);
    if (customerOrderMatch) {
      characteristics.push({
        type: 'customer_order',
        value: customerOrderMatch[0],
        display_name: `Order ${customerOrderMatch[0]}`,
        is_system_generated: true
      });
    }
    
    // Detect part family from stock code pattern
    const partFamilyMatch = order.stock_code.match(/^([A-Z]{2,4})/);
    if (partFamilyMatch) {
      characteristics.push({
        type: 'part_family',
        value: partFamilyMatch[1],
        display_name: `${partFamilyMatch[1]} Family`,
        is_system_generated: true
      });
    }
    
    // Detect material from description
    const materialKeywords = ['steel', 'aluminum', 'brass', 'plastic', 'stainless'];
    const materialMatch = materialKeywords.find(material => 
      order.description.toLowerCase().includes(material)
    );
    if (materialMatch) {
      characteristics.push({
        type: 'material',
        value: materialMatch,
        display_name: materialMatch.charAt(0).toUpperCase() + materialMatch.slice(1),
        is_system_generated: true
      });
    }
    
    return characteristics;
  }
}
```

#### 1.2 Color Management System

**Smart Color Assignment**:
```javascript
// backend/src/services/colorAssignmentService.js

class ColorAssignmentService {
  static colorPalette = [
    '#3B82F6', // Blue
    '#10B981', // Green  
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6B7280'  // Gray
  ];
  
  static async assignColorsToCharacteristics(characteristics) {
    const existingAssignments = await this.getExistingColorAssignments();
    const assignments = new Map(existingAssignments);
    let colorIndex = assignments.size;
    
    return characteristics.map(char => {
      const key = `${char.type}_${char.value}`;
      
      if (!assignments.has(key)) {
        assignments.set(key, this.colorPalette[colorIndex % this.colorPalette.length]);
        colorIndex++;
      }
      
      return {
        ...char,
        color: assignments.get(key)
      };
    });
  }
  
  static async getExistingColorAssignments() {
    // Get existing characteristic/color pairs from database
    const existing = await JobCharacteristic.findAll({
      attributes: ['type', 'value', 'color'],
      group: ['type', 'value', 'color']
    });
    
    return existing.map(char => [
      `${char.type}_${char.value}`,
      char.color
    ]);
  }
}

#### 1.3 Frontend: Enhanced Job Cards with Characteristics

**Job Characteristics Display**:
```tsx
// frontend/src/components/order-card.tsx

interface OrderCardProps {
  order: ManufacturingOrder;
  isDragging?: boolean;
  characteristicSettings?: UserCharacteristicSettings; // From user settings
}

interface UserCharacteristicSettings {
  enabled: boolean;
  primaryCharacteristic?: string; // 'customer_order', 'material', etc.
  secondaryCharacteristic?: string;
}

export const OrderCard = ({ order, isDragging, characteristicSettings }) => {
  const characteristics = order.job_characteristics || [];
  
  // Get user-selected characteristics for display
  const primaryChar = characteristics.find(c => 
    c.type === characteristicSettings?.primaryCharacteristic
  );
  const secondaryChar = characteristics.find(c => 
    c.type === characteristicSettings?.secondaryCharacteristic
  );
  
  const showCharacteristics = characteristicSettings?.enabled && (primaryChar || secondaryChar);
  
  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md relative",
      isDragging && "opacity-90 rotate-1 shadow-lg scale-105"
    )}
    style={{
      // Primary characteristic as card background tint
      backgroundColor: primaryChar ? `${primaryChar.color}08` : undefined
    }}>
      
      {/* Primary characteristic color stripe at top */}
      {showCharacteristics && primaryChar && (
        <div 
          className="h-2 w-full rounded-t-md"
          style={{ backgroundColor: primaryChar.color }}
        />
      )}
      
      {/* Secondary characteristic color band on left edge */}
      {showCharacteristics && secondaryChar && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
          style={{ backgroundColor: secondaryChar.color }}
        />
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <span className="font-semibold">{order.order_number}</span>
          <PriorityBadge priority={order.priority} />
        </div>
        <p className="text-sm text-gray-600">{order.stock_code}</p>
      </CardHeader>
      
      <CardContent className="space-y-2">
        <p className="text-sm">{order.description}</p>
        
        {/* Current operation display */}
        <div className="bg-gray-50 p-2 rounded-md">
          <span className="font-medium text-sm">
            {order.current_operation || 'No operation set'}
          </span>
        </div>
        
        {/* Characteristic badges (when enabled) */}
        {showCharacteristics && (primaryChar || secondaryChar) && (
          <div className="flex gap-1 flex-wrap">
            {primaryChar && (
              <Badge 
                variant="secondary" 
                className="text-xs"
                style={{ 
                  backgroundColor: `${primaryChar.color}20`,
                  color: primaryChar.color,
                  borderColor: primaryChar.color
                }}
              >
                {primaryChar.display_name || primaryChar.value}
              </Badge>
            )}
            {secondaryChar && (
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ 
                  borderColor: secondaryChar.color,
                  color: secondaryChar.color
                }}
              >
                {secondaryChar.display_name || secondaryChar.value}
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>{order.quantity_completed}/{order.quantity_to_make}</span>
          <span>Due: {formatDate(order.due_date)}</span>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### 1.4 User Settings for Characteristic Display

**Characteristic Settings Component**:
```tsx
// frontend/src/components/characteristic-settings.tsx

export const CharacteristicSettings = () => {
  const [settings, setSettings] = useUserSettings('visual_characteristics');
  const { availableCharacteristics } = useAvailableCharacteristics();
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="enable-characteristics">Visual Job Grouping</Label>
        <Switch
          id="enable-characteristics"
          checked={settings.enabled || false}
          onCheckedChange={(enabled) => 
            setSettings({ ...settings, enabled })
          }
        />
      </div>
      
      {settings.enabled && (
        <div className="space-y-4 ml-4">
          <div>
            <Label>Primary Characteristic (Card Color)</Label>
            <Select 
              value={settings.primaryCharacteristic || ''}
              onValueChange={(value) => 
                setSettings({ ...settings, primaryCharacteristic: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose primary grouping..." />
              </SelectTrigger>
              <SelectContent>
                {availableCharacteristics.map(char => (
                  <SelectItem key={char.type} value={char.type}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: char.sampleColor }}
                      />
                      {char.displayName}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Secondary Characteristic (Left Edge)</Label>
            <Select 
              value={settings.secondaryCharacteristic || ''}
              onValueChange={(value) => 
                setSettings({ ...settings, secondaryCharacteristic: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional secondary grouping..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {availableCharacteristics
                  .filter(char => char.type !== settings.primaryCharacteristic)
                  .map(char => (
                    <SelectItem key={char.type} value={char.type}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: char.sampleColor }}
                        />
                        {char.displayName}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Preview */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <Label className="text-xs text-gray-600">Preview</Label>
            <OrderCardPreview settings={settings} />
          </div>
        </div>
      )}
    </div>
  );
};
```

#### 1.5 Characteristic Legend Component

**Legend Display**:
```tsx
// frontend/src/components/characteristic-legend.tsx

export const CharacteristicLegend = ({ characteristics, settings }) => {
  if (!settings.enabled || !characteristics.length) return null;
  
  // Group characteristics by type
  const grouped = groupBy(characteristics, 'type');
  const activeTypes = [settings.primaryCharacteristic, settings.secondaryCharacteristic]
    .filter(Boolean);
  
  return (
    <div className="bg-gray-50 border rounded-lg p-3 mb-4">
      <h4 className="text-sm font-medium mb-2">Visual Grouping Legend</h4>
      <div className="flex flex-wrap gap-4">
        {activeTypes.map(type => {
          const items = grouped[type] || [];
          return (
            <div key={type} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">
                {formatCharacteristicTypeName(type)}:
              </span>
              <div className="flex gap-1">
                {items.slice(0, 5).map(item => (
                  <div 
                    key={item.value}
                    className="flex items-center gap-1 text-xs"
                  >
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.display_name || item.value}</span>
                  </div>
                ))}
                {items.length > 5 && (
                  <span className="text-xs text-gray-500">+{items.length - 5} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### Phase 2: Dynamic Current Operations (Week 3-4)

#### 2.1 Fix Hardcoded Operation Placeholders

**Objective**: Replace static current_operation fields with dynamic calculation from manufacturing_steps.

**Enhanced ManufacturingOrder Model**:
```javascript
// backend/src/models/ManufacturingOrder.js

class ManufacturingOrder extends Model {
  async getCurrentOperationInfo() {
    const steps = await this.getManufacturingSteps({
      order: [['step_number', 'ASC']]
    });
    
    if (!steps.length) {
      return {
        operation: 'No steps defined',
        stepNumber: 0,
        progress: 0,
        isComplete: false
      };
    }
    
    // Find first in_progress step, or first pending step
    const currentStep = steps.find(step => step.status === 'in_progress') ||
                       steps.find(step => step.status === 'pending');
    
    if (!currentStep) {
      // All steps complete
      return {
        operation: 'Complete',
        stepNumber: steps.length,
        progress: 100,
        isComplete: true
      };
    }
    
    const completedSteps = steps.filter(step => step.status === 'complete').length;
    const nextStep = steps.find(step => 
      step.step_number > currentStep.step_number && step.status === 'pending'
    );
    
    return {
      operation: currentStep.operation_name,
      stepNumber: currentStep.step_number,
      progress: Math.round((completedSteps / steps.length) * 100),
      nextOperation: nextStep?.operation_name,
      isComplete: false
    };
  }
  
  async updateCurrentOperation() {
    const operationInfo = await this.getCurrentOperationInfo();
    await this.update({
      current_operation: operationInfo.operation
    });
    return operationInfo;
  }
}
```

#### 2.2 Automatic Step Progression 

**Enhanced Step Completion Logic**:
```javascript
// backend/src/controllers/ordersController.js

exports.completeStep = async (req, res) => {
  const { id: orderId, stepId } = req.params;
  
  try {
    const step = await ManufacturingStep.findByPk(stepId);
    const order = await ManufacturingOrder.findByPk(orderId);
    
    // Complete the step
    await step.update({
      status: 'complete',
      completed_at: new Date(),
      actual_duration_minutes: step.calculateDuration()
    });
    
    // Update order's current operation
    await order.updateCurrentOperation();
    
    // Log the progression for future learning
    await AuditLog.create({
      action: 'step_completed',
      order_id: orderId,
      step_id: stepId,
      user_id: req.user.id,
      metadata: {
        operation: step.operation_name,
        work_centre: step.work_centre_id,
        duration_minutes: step.actual_duration_minutes
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Phase 3: Part Routes & Templates (Week 5-6)

#### 3.1 Part Route Data Model

**Objective**: Create reusable route templates for parts, with order inheritance system.

**Part Route Schema**:
```sql
-- Part Routes (reusable operation templates)
CREATE TABLE part_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(part_number) -- One active route per part
);

-- Route Operations (sequence of operations in a route)
CREATE TABLE route_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    estimated_duration_minutes INTEGER,
    preferred_work_centre_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES part_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (preferred_work_centre_id) REFERENCES work_centres(id),
    UNIQUE(route_id, sequence_number)
);

-- Link orders to their inherited routes
ALTER TABLE manufacturing_orders 
ADD COLUMN part_route_id INTEGER,
ADD FOREIGN KEY (part_route_id) REFERENCES part_routes(id);
```

**PartRoute Model**:
```javascript
// backend/src/models/PartRoute.js

class PartRoute extends Model {
  static associate(models) {
    PartRoute.hasMany(models.RouteOperation, { 
      foreignKey: 'route_id',
      as: 'operations',
      order: [['sequence_number', 'ASC']]
    });
    PartRoute.hasMany(models.ManufacturingOrder, {
      foreignKey: 'part_route_id',
      as: 'orders'
    });
    PartRoute.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
  }
  
  // Apply route to new order (fundamental requirement)
  async applyToOrder(orderId, options = {}) {
    const operations = await this.getOperations();
    
    if (!operations.length) {
      throw new Error('Route has no operations defined');
    }
    
    // Create manufacturing steps from route operations
    const steps = operations.map((op, index) => ({
      order_id: orderId,
      step_number: op.sequence_number,
      operation_name: op.operation_name,
      work_centre_id: op.preferred_work_centre_id,
      estimated_duration_minutes: op.estimated_duration_minutes,
      status: index === 0 ? 'pending' : 'not_started',
      notes: op.notes
    }));
    
    const createdSteps = await ManufacturingStep.bulkCreate(steps);
    
    // Update order to reference this route
    await ManufacturingOrder.update(
      { part_route_id: this.id },
      { where: { id: orderId } }
    );
    
    return createdSteps;
  }
  
  // Find or suggest route for part number
  static async findOrSuggestForPart(partNumber) {
    // Look for exact match first
    let route = await this.findOne({
      where: { part_number: partNumber, is_active: true },
      include: ['operations']
    });
    
    if (route) {
      return { route, type: 'exact' };
    }
    
    // Look for similar part patterns
    const similarRoutes = await this.findAll({
      where: {
        part_number: { [Op.like]: `${partNumber.substring(0, 4)}%` },
        is_active: true
      },
      include: ['operations'],
      limit: 3
    });
    
    return { 
      route: similarRoutes[0] || null, 
      type: 'suggested',
      alternatives: similarRoutes 
    };
  }
}
```

#### 3.2 Order Creation with Route Inheritance

**Enhanced Order Creation**:
```javascript
// backend/src/controllers/ordersController.js

exports.createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { part_number, stock_code, ...orderData } = req.body;
    
    // Create the order first
    const order = await ManufacturingOrder.create(orderData, { transaction });
    
    // Auto-inherit route if part has one (fundamental requirement)
    const partNumber = part_number || stock_code;
    if (partNumber) {
      const routeInfo = await PartRoute.findOrSuggestForPart(partNumber);
      
      if (routeInfo.route) {
        await routeInfo.route.applyToOrder(order.id);
        
        // Log the inheritance
        await AuditLog.create({
          action: 'route_inherited',
          order_id: order.id,
          user_id: req.user.id,
          metadata: {
            route_id: routeInfo.route.id,
            part_number: partNumber,
            inheritance_type: routeInfo.type
          }
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Return order with inherited steps
    const fullOrder = await ManufacturingOrder.findByPk(order.id, {
      include: ['manufacturing_steps', 'part_route']
    });
    
    res.status(201).json(fullOrder);
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ error: error.message });
  }
};
```

---

## Database Migration Strategy

### Minimal Schema Changes

Rather than major schema overhaul, we enhance existing structure:

```sql
-- Add operation categorization
ALTER TABLE manufacturing_steps 
ADD COLUMN operation_type VARCHAR(20) DEFAULT 'general';

-- Add route templates (optional)
CREATE TABLE part_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    is_template BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    UNIQUE(part_number)
);

CREATE TABLE route_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    sequence_number INTEGER NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    operation_type VARCHAR(20) DEFAULT 'general',
    estimated_duration_minutes INTEGER,
    preferred_work_centre_id INTEGER,
    FOREIGN KEY (route_id) REFERENCES part_routes(id),
    FOREIGN KEY (preferred_work_centre_id) REFERENCES work_centres(id),
    UNIQUE(route_id, sequence_number)
);

-- Add user settings
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSON NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, setting_key)
);
```

---

## Testing Strategy

### Phase 1 Tests
- Dynamic operation calculation accuracy
- Visual component rendering
- Settings persistence

### Phase 2 Tests  
- Step progression logic
- Automatic status updates
- Audit trail accuracy

### Phase 3 Tests
- Suggestion algorithm accuracy
- Historical pattern analysis
- Confidence scoring

### Phase 4 Tests
- Route template application
- Bulk operation creation
- Template sharing

---

## Performance Considerations

### Optimization Targets
- Keep job card render time under 50ms
- Cache operation type calculations
- Lazy load route suggestions
- Debounce settings updates

### Monitoring
- Track suggestion acceptance rates
- Monitor render performance
- Measure user adoption of visual features

---

## Success Metrics

### Technical Metrics
- Eliminate hardcoded operation displays (100%)
- Achieve <100ms API response times
- 95%+ test coverage for new features

### User Adoption Metrics
- Visual characteristics adoption rate
- Step progression accuracy improvement
- Suggestion acceptance rate (target >40%)

### Business Impact
- Reduced job location time
- Improved operation visibility
- Enhanced workflow efficiency

---

## Risk Mitigation

### Technical Risks
- **Database performance**: Add proper indexing, implement caching
- **UI complexity**: Progressive disclosure, user settings controls
- **Migration issues**: Comprehensive testing, rollback procedures

### User Adoption Risks
- **Feature overwhelm**: Default to simple interface, optional enhancements
- **Training requirements**: Intuitive design, contextual help
- **Workflow disruption**: Maintain backward compatibility

---

#### 3.3 Route Builder Interface

**Manual Route Creation Component**:
```tsx
// frontend/src/components/route-builder.tsx

export const RouteBuilder = ({ partNumber, existingRoute, onSave }) => {
  const [operations, setOperations] = useState(existingRoute?.operations || []);
  const { workCentres } = useWorkCentres();
  
  const addOperation = () => {
    setOperations([...operations, {
      sequence_number: operations.length + 1,
      operation_name: '',
      estimated_duration_minutes: 60,
      preferred_work_centre_id: null,
      notes: ''
    }]);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">
          {existingRoute ? 'Edit' : 'Create'} Route for {partNumber}
        </h3>
        <Button variant="outline" onClick={addOperation}>
          + Add Operation
        </Button>
      </div>
      
      <div className="space-y-3">
        {operations.map((operation, index) => (
          <OperationEditor
            key={index}
            operation={operation}
            workCentres={workCentres}
            onChange={(updated) => updateOperation(index, updated)}
            onRemove={() => removeOperation(index)}
            onMoveUp={index > 0 ? () => moveOperation(index, -1) : null}
            onMoveDown={index < operations.length - 1 ? () => moveOperation(index, 1) : null}
          />
        ))}
      </div>
      
      {operations.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No operations defined yet.</p>
          <p className="text-sm">Add operations to create a manufacturing route.</p>
        </div>
      )}
      
      <div className="flex gap-2 pt-4 border-t">
        <Button 
          onClick={() => saveRoute(partNumber, operations)}
          disabled={operations.length === 0}
        >
          {existingRoute ? 'Update' : 'Create'} Route
        </Button>
        <Button variant="outline" onClick={() => suggestFromSimilar(partNumber)}>
          Suggest from Similar Parts
        </Button>
      </div>
    </div>
  );
};
```

### Phase 4: Historical Learning & Intelligence (Week 7-8)

#### 4.1 Data Collection for Learning

**Objective**: Collect movement and routing data to enable future intelligent suggestions.

**Enhanced Audit Logging**:
```javascript
// backend/src/services/learningDataService.js

class LearningDataService {
  static async logRouteDecision(orderData) {
    // Log route-related decisions for future learning
    await AuditLog.create({
      action: 'route_decision',
      order_id: orderData.orderId,
      user_id: orderData.userId,
      metadata: {
        part_number: orderData.partNumber,
        chosen_route: orderData.routeId,
        suggested_route: orderData.suggestedRouteId,
        route_source: orderData.routeSource, // 'manual', 'inherited', 'suggested'
        decision_reason: orderData.reason,
        work_centre_movements: orderData.movements,
        operation_sequence: orderData.operations
      }
    });
  }
  
  static async analyzePartPatterns(partNumber) {
    // Analyze historical data for part families
    const similarParts = await this.findSimilarParts(partNumber);
    const movementPatterns = await this.extractMovementPatterns(similarParts);
    
    return {
      commonOperations: this.getMostCommonOperations(movementPatterns),
      typicalWorkCentres: this.getMostUsedWorkCentres(movementPatterns),
      averageDurations: this.calculateAverageDurations(movementPatterns),
      confidence: this.calculatePatternConfidence(movementPatterns)
    };
  }
  
  static async suggestRouteForNewPart(partNumber) {
    const patterns = await this.analyzePartPatterns(partNumber);
    
    if (patterns.confidence < 0.5) {
      return null; // Not enough data for reliable suggestion
    }
    
    return {
      suggestedOperations: patterns.commonOperations,
      confidence: patterns.confidence,
      basedOnParts: patterns.similarPartCount,
      reasoning: `Based on ${patterns.similarPartCount} similar parts`
    };
  }
}
```

#### 4.2 Route Suggestion System

**Smart Route Suggestions**:
```tsx
// frontend/src/components/route-suggestions.tsx

export const RouteSuggestionPanel = ({ partNumber, onAcceptSuggestion }) => {
  const { suggestion, loading } = useRouteSuggestion(partNumber);
  
  if (loading) return <div>Analyzing similar parts...</div>;
  if (!suggestion) return null;
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="text-blue-600">
          <BrainIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-blue-900">Suggested Route</h4>
          <p className="text-sm text-blue-800 mb-3">
            {suggestion.reasoning} ({Math.round(suggestion.confidence * 100)}% confidence)
          </p>
          
          <div className="space-y-2">
            {suggestion.suggestedOperations.map((op, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{index + 1}</Badge>
                <span>{op.operation_name}</span>
                <span className="text-gray-500">
                  (~{op.estimated_duration_minutes}min)
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onAcceptSuggestion(suggestion)}
          >
            Use This Route
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dismissSuggestion(partNumber)}
          >
            Create Custom
          </Button>
        </div>
      </div>
    </div>
  );
};
```

---

## Implementation Timeline

### Week 1-2: Job Characteristics & Visual Grouping
- [ ] Job characteristics data model and API
- [ ] Color assignment system
- [ ] Enhanced OrderCard with 1-2 characteristic display
- [ ] User settings for characteristic selection
- [ ] Characteristic legend component

### Week 3-4: Dynamic Current Operations  
- [ ] Fix hardcoded current_operation placeholders
- [ ] Dynamic operation calculation from steps
- [ ] Automatic step progression logic
- [ ] Enhanced step completion tracking

### Week 5-6: Part Routes & Templates
- [ ] Part route data model and schema
- [ ] Route inheritance for new orders (fundamental)
- [ ] Manual route builder interface
- [ ] Route management and editing

### Week 7-8: Historical Learning & Intelligence
- [ ] Enhanced audit logging for learning
- [ ] Pattern analysis for similar parts
- [ ] Route suggestion algorithm
- [ ] Smart suggestion UI components

---

This plan transforms hardcoded placeholders into a dynamic, intelligent system while maintaining the simplicity that makes our planning board effective. Each phase builds naturally on the previous, allowing users to adopt features at their own pace.