# Feature Request: Standardize Data Format Across Frontend and Backend

## Overview
Refactor frontend components to use the same data format as the backend API, eliminating the dual format system currently in place.

## Changes Required

### 1. Remove Type Duplication
- Delete `LegacyManufacturingOrder`, `LegacyWorkCentre`, `LegacyManufacturingStep` interfaces from `types/manufacturing.ts`
- Use only the API format types: `ManufacturingOrder`, `WorkCentre`, `ManufacturingStep`

### 2. Update Frontend Components
- Change all component props from camelCase to snake_case:
  - `orderNumber` → `order_number`
  - `stockCode` → `stock_code`  
  - `workCentre` → `work_centre_code`
  - `currentStep` → `current_step`
  - `quantityToMake` → `quantity_to_make`
  - `quantityCompleted` → `quantity_completed`

### 3. Update Status Handling
- Change status format from `"in-progress"` to `"in_progress"`
- Update status enums: `"not-started"` → `"not_started"`

### 4. Remove Data Transformation Layer
- Delete `frontend/src/lib/data-adapters.ts`
- Remove all `adaptOrderToLegacy()` and `adaptWorkCentreToLegacy()` function calls
- Update components to work directly with API response format

### 5. Update ID Handling
- Change string IDs to numeric where appropriate
- Use `work_centre_id` instead of `work_centre_code` for relationships

## Files to Modify
- `frontend/src/types/manufacturing.ts`
- `frontend/src/components/planning-board.tsx`
- `frontend/src/components/orders-table.tsx`
- `frontend/src/components/order-card.tsx` (if exists)
- All API service calls in `frontend/src/lib/api-services.ts`
- Dashboard and analytics components

## Expected Outcome
- Single consistent data format throughout the application
- Elimination of transformation functions
- Simplified codebase with reduced complexity
- Direct API response usage in frontend components