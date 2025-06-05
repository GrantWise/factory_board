# Feature Request: Unified Order Import API (CSV & 3rd Party Integration)

## Overview
Implement a single backend API endpoint to handle importing manufacturing orders, supporting both CSV uploads from the frontend and direct integration from 3rd party systems. This endpoint will centralize all business logic for order creation, updates, and validation, ensuring data integrity and simplifying frontend and integration code.

## Changes Required

### 1. New API Endpoint
- **POST** `/api/orders/import`
- Accepts an array of order objects in the same format as the main API (`ManufacturingOrder` fields).
- Used by both the frontend CSV import and 3rd party integrations.

### 2. Backend Processing Logic
- For each order in the payload:
  - **If order does not exist:**
    - Create a new order.
  - **If order exists and status is `not_started`:**
    - Update the order with the new data from the import.
  - **If order exists and status is `in_progress`, `complete`, or any other non-editable state:**
    - Skip the import for this order and return a message indicating it was not updated.
- Validate all required fields and types.
- Apply all business rules (e.g., no duplicate order numbers, valid work centre IDs, etc.).

### 3. Response Format
- Return a summary for each row/order:
  - `order_number`: The order number from the import.
  - `status`: One of `created`, `updated`, `skipped`, `error`.
  - `message`: Human-readable message (e.g., "Order created", "Order updated", "Order already in progress, not updated", "Missing required field: stock_code").
- Example response:

```json
{
  "created": 5,
  "updated": 2,
  "skipped": 3,
  "errors": 1,
  "details": [
    { "order_number": "ORD001", "status": "created", "message": "Order created" },
    { "order_number": "ORD002", "status": "updated", "message": "Order updated" },
    { "order_number": "ORD003", "status": "skipped", "message": "Order already in progress, not updated" },
    { "order_number": "ORD004", "status": "error", "message": "Missing required field: stock_code" }
  ]
}
```

### 4. Reusability & Integration
- The same endpoint and logic should be used for:
  - Frontend CSV import
  - 3rd party system integrations (e.g., MES, ERP, external schedulers)
- This ensures consistent business rules and reduces code duplication.

### 5. Business Rules & Validation
- All required fields must be present (`order_number`, `stock_code`, `description`, `quantity_to_make`, etc.).
- No duplicate order numbers in the same import batch.
- If an order is updated, only allow updates if status is `not_started`.
- If an order is skipped or errored, include a clear message in the response.
- Validate all foreign keys (e.g., work centre IDs).

### 6. Example Payload

```json
[
  {
    "order_number": "ORD001",
    "stock_code": "STK1",
    "description": "Widget A",
    "quantity_to_make": 100,
    "priority": "high",
    "status": "not_started",
    "work_centre_id": 1,
    "due_date": "2024-07-01"
  },
  {
    "order_number": "ORD002",
    "stock_code": "STK2",
    "description": "Widget B",
    "quantity_to_make": 50,
    "priority": "medium",
    "status": "not_started",
    "work_centre_id": 2,
    "due_date": "2024-07-05"
  }
]
```

### 7. Rationale
- Centralizing import logic in the backend ensures data integrity and consistent business rules.
- Simplifies frontend and integration code (no need to duplicate validation or upsert logic).
- Makes it easy to add new import sources in the future.
- Provides clear feedback to users and integrators about what was imported, updated, skipped, or errored.

## Files/Areas to Modify
- Backend API controller for `/api/orders/import`
- Order model/service for upsert and validation logic
- API documentation (OpenAPI/Swagger)

## Expected Outcome
- Single, robust import API for all order import scenarios
- Consistent, reliable data handling
- Clear feedback for users and integrators
- Easier maintenance and future extensibility 