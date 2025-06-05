# Manufacturing Planning Board - Drag and Drop Implementation Review

## Executive Summary

After reviewing the current drag-and-drop implementation, I've identified **critical issues** that need immediate attention. The current codebase is using **dnd-kit** instead of the standardized **Atlassian Pragmatic Drag and Drop** library, which contradicts the project's stated standards and creates inconsistencies with best practices.

## Current State Analysis

### Major Issues Identified

#### 1. **Wrong Library Implementation** 🚨 CRITICAL
- **Current**: Using `@dnd-kit/core` throughout the frontend
- **Required**: Should be using `@atlaskit/pragmatic-drag-and-drop`
- **Impact**: Complete library mismatch, performance issues, maintainability problems

#### 2. **Incomplete Migration** 🚨 CRITICAL
```typescript
// Found in planning-board.tsx - INCORRECT
import {
  DndContext,
  DragOverlay,
  closestCenter,
  // ... other dnd-kit imports
} from "@dnd-kit/core"

// Should be using Pragmatic DnD:
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
```

#### 3. **Architecture Violations**
- Using React Context + useState for drag state (heavy, complex)
- Should use native DOM events with Pragmatic DnD's lightweight approach
- Complex sensor system instead of native drag/drop primitives

#### 4. **Performance Issues**
- Large bundle size from dnd-kit imports
- Complex re-rendering patterns
- Unnecessary state management overhead

## Detailed Findings

### Files Using Incorrect Implementation

1. **`frontend/src/components/planning-board.tsx`**
   - Lines 35-45: dnd-kit imports
   - Lines 200+: Complex DndContext setup
   - Should be: Simple draggable/dropTarget registration

2. **`frontend/src/hooks/use-drag-and-drop.tsx`**
   - Using dnd-kit event types
   - Complex state management
   - Should be: Lightweight event handlers

3. **`frontend/src/components/work-centres-management.tsx`**
   - Lines 210+: dnd-kit sortable implementation
   - Should be: Simple Pragmatic DnD draggable

### Missing Functionality

Based on design docs, these features are not properly implemented:

1. **Real-time Collaboration**
   - Lock indicators during drag
   - Multi-user conflict prevention
   - Visual feedback for other users' actions

2. **Work Centre Column Reordering**
   - Inconsistent implementation
   - Backend sync issues
   - Visual feedback problems

3. **Order Movement Validation**
   - No proper drop zone validation
   - Missing work centre capacity checks
   - Incomplete conflict resolution

## Remediation Plan

### Phase 1: Library Migration (Priority: CRITICAL - 2-3 days)

#### Step 1.1: Install Correct Dependencies
```bash
# Remove incorrect dependencies
npm uninstall @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Install Pragmatic DnD
npm install @atlaskit/pragmatic-drag-and-drop
npm install @atlaskit/pragmatic-drag-and-drop-hitbox
npm install @atlaskit/pragmatic-drag-and-drop-react-drop-indicator
npm install tiny-invariant
```

#### Step 1.2: Core Component Migration

**PlanningBoard Component - New Implementation Pattern:**
```typescript
// NEW: Pragmatic DnD approach
import { useEffect, useRef } from 'react';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import invariant from 'tiny-invariant';

// Lightweight, performance-focused implementation
function DraggableOrderCard({ order }) {
  const ref = useRef(null);
  
  useEffect(() => {
    const element = ref.current;
    invariant(element);
    
    return draggable({
      element,
      getInitialData: () => ({ order }),
    });
  }, [order]);
  
  return <div ref={ref}>...</div>;
}

function DroppableWorkCentre({ workCentre }) {
  const ref = useRef(null);
  
  useEffect(() => {
    const element = ref.current;
    invariant(element);
    
    return dropTargetForElements({
      element,
      getData: () => ({ workCentre }),
      onDrop: ({ source }) => {
        // Handle drop logic
      },
    });
  }, [workCentre]);
  
  return <div ref={ref}>...</div>;
}
```

### Phase 2: Feature Implementation (Priority: HIGH - 3-4 days)

#### Step 2.1: Real-time Collaboration
```typescript
// Global monitor for conflict prevention
useEffect(() => {
  return monitorForElements({
    onDragStart: ({ source }) => {
      // Lock order in backend
      // Notify other users via WebSocket
    },
    onDrop: ({ source, location }) => {
      // Release lock
      // Update backend
      // Notify completion
    },
  });
}, []);
```

#### Step 2.2: Visual Feedback System
```typescript
// Proper drop indicators using Pragmatic DnD patterns
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator';

// Enhanced drop target with visual feedback
return dropTargetForElements({
  element,
  getData: ({ input, element }) => 
    attachClosestEdge({ 
      input, 
      element,
      allowedEdges: ['top', 'bottom'] 
    }),
  onDragEnter: () => setIsOver(true),
  onDragLeave: () => setIsOver(false),
});
```

### Phase 3: Backend Integration (Priority: MEDIUM - 2-3 days)

#### Step 3.1: Order Movement API Enhancement
```typescript
// Enhanced move validation
const moveOrder = async (orderId: number, targetWorkCentreId: number) => {
  try {
    // 1. Check work centre capacity
    // 2. Validate user permissions
    // 3. Check for conflicts
    // 4. Execute move with optimistic updates
    await ordersService.move(orderId, targetWorkCentreId);
    
    // 5. Broadcast to WebSocket
    // 6. Update local state
  } catch (error) {
    // 7. Rollback optimistic updates
    // 8. Show error feedback
  }
};
```

#### Step 3.2: Work Centre Reordering
```typescript
// Robust reordering with conflict resolution
const handleWorkCentreReorder = async (newOrder: WorkCentre[]) => {
  const reorderData = newOrder.map((wc, index) => ({
    id: wc.id,
    display_order: index + 1
  }));
  
  try {
    await workCentresService.reorder(reorderData);
    // Success handling
  } catch (error) {
    // Revert local state
    // Show error message
  }
};
```

### Phase 4: Testing & Validation (Priority: MEDIUM - 2 days)

#### Step 4.1: Comprehensive Testing
- Unit tests for drag/drop components
- Integration tests for API calls
- E2E tests for complete workflows
- Performance testing vs. current implementation

#### Step 4.2: User Experience Validation
- Touch device testing
- Accessibility compliance
- Cross-browser compatibility
- Real-time collaboration testing

## Implementation Timeline

| Phase | Duration | Priority | Deliverables |
|-------|----------|----------|--------------|
| Phase 1 | 2-3 days | CRITICAL | Complete library migration |
| Phase 2 | 3-4 days | HIGH | Full feature implementation |
| Phase 3 | 2-3 days | MEDIUM | Backend integration |
| Phase 4 | 2 days | MEDIUM | Testing & validation |
| **Total** | **9-12 days** | - | Production-ready implementation |

## Success Criteria

### Performance Metrics
- [ ] Bundle size reduction: >50% smaller than dnd-kit
- [ ] Drag initiation latency: <100ms
- [ ] Drop handling: <50ms
- [ ] Memory usage: <50% of current implementation

### Functionality Criteria
- [ ] Order cards drag smoothly between work centres
- [ ] Work centre columns reorder with backend persistence
- [ ] Real-time collaboration with conflict prevention
- [ ] Touch device compatibility
- [ ] Accessibility compliance (WCAG 2.1 AA)

### Code Quality Criteria
- [ ] Zero dnd-kit dependencies remaining
- [ ] 100% TypeScript coverage for drag/drop code
- [ ] Comprehensive test coverage (>90%)
- [ ] Documentation for all drag/drop components

## Risk Mitigation

### Technical Risks
1. **Migration Complexity**: Implement incremental migration, component by component
2. **Performance Regression**: Extensive testing before deployment
3. **User Experience Changes**: Maintain familiar interaction patterns

### Business Risks
1. **Development Timeline**: Parallel development with feature freeze
2. **User Disruption**: Deploy during low-usage periods
3. **Rollback Plan**: Maintain dnd-kit version in separate branch

## Next Steps

1. **Immediate Action**: Begin Phase 1 library migration
2. **Team Coordination**: Brief team on new architecture patterns
3. **Documentation**: Update development guidelines for Pragmatic DnD
4. **Monitoring**: Set up performance tracking for new implementation

## Conclusion

The current drag-and-drop implementation requires a **complete rewrite** using Atlassian's Pragmatic Drag and Drop library. While this represents significant work, it will result in:

- **Better Performance**: Smaller bundle, faster interactions
- **Standards Compliance**: Aligned with project architectural decisions
- **Enhanced Maintainability**: Simpler, more predictable code
- **Future-Proof**: Built on web platform standards

**Recommendation**: Prioritize this migration as CRITICAL due to the architectural mismatch and performance implications.