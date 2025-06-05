# Unified Order Import API Implementation Plan

## Gap Analysis

### 1. API Endpoint
- **Exists:** `POST /api/orders/import` is routed and stubbed in the controller.
- **Missing:** Actual implementation for handling payloads, validation, upsert logic, and response formatting.

### 2. Payload Handling
- **Exists:** JSON body parsing is enabled for the API.
- **Confirmed:** The backend **only needs to handle JSON**. CSV parsing and upload are handled by the frontend, which converts CSV to JSON before sending to the backend.
- **Not Required:** No support for file uploads (CSV/Excel) or CSV parsing utility is needed in the backend.

### 3. Business Logic
- **Exists:** 
  - Order creation and update logic, including validation and business rules, is implemented for single orders.
  - Joi schemas for order validation are present.
- **Missing:** 
  - Batch processing logic for multiple orders in a single request.
  - Logic to check for duplicates within the import batch.
  - Logic to skip or error orders based on status or missing fields.
  - Unified upsert logic (create if not exists, update if allowed, skip/error otherwise).
  - Per-row result summary as specified.

### 4. Validation
- **Exists:** 
  - Joi validation for single order creation/update.
  - Foreign key checks for work centre IDs.
- **Missing:** 
  - Batch validation for arrays of orders.
  - Validation for duplicate order numbers within the import batch.
  - Aggregated error reporting for batch operations.

### 5. Response Format
- **Exists:** Standardized error and success response patterns.
- **Missing:** 
  - The detailed per-order summary (created, updated, skipped, error) as required by the feature request.

### 6. Reusability
- **Exists:** 
  - Service/model methods for order creation and update.
- **Missing:** 
  - Centralized import logic that can be reused by both frontend CSV-to-JSON and 3rd party JSON integrations.

### 7. Testing
- **Exists:** 
  - Extensive tests for single order CRUD, permissions, and validation.
- **Missing:** 
  - No tests for the import endpoint or batch upsert.

---

## Implementation Plan

### 1. Design & Planning
- Review and document the required fields, business rules, and error cases for import.
- Define the unified import payload structure and response format (JSON, as in the feature request).
- **Confirm that only existing statuses (such as 'not_started') are used. Do not introduce new statuses.**

### 2. Controller Logic
- Implement the `importOrders` controller to:
  - Accept an array of order objects (JSON) from the frontend or 3rd party integrations.
  - Parse and validate each order.
  - For each order:
    - If order number does not exist, create the order.
    - If order exists and status is `not_started`, update the order.
    - If order exists and status is not editable, skip and record a message.
    - Validate all required fields and foreign keys.
    - Check for duplicate order numbers within the batch.
  - Collect and return a summary for each order as specified.

### 3. Service/Helper Layer
- Refactor reusable upsert and validation logic into a service/helper to avoid duplication.
- Ensure all business rules are enforced consistently.

### 4. Response Formatting
- Implement the response format as per the feature request, including counts and per-order details.

### 5. Error Handling
- Use existing error handling and validation middleware for consistency.
- Ensure all errors are reported in the standardized format.

### 6. Testing
- Add integration tests for the import endpoint:
  - Test importing new orders, updating existing, skipping, and error cases.
  - Test duplicate order numbers in the batch.
  - Test JSON payloads only (CSV is not handled by the backend).
- Add unit tests for the import service/helper logic.

### 7. Documentation
- Update API documentation (OpenAPI/Swagger) to describe the new endpoint, payload, and response.
- Add usage examples for JSON import.

### 8. Code Review & Refactoring
- Ensure all code follows established patterns and conventions.
- Refactor as needed for maintainability and clarity.

---

## Progress Tracking Checklist

- [ ] Design & Planning
- [ ] Import Controller Implementation
- [ ] Service/Helper Layer Refactor
- [ ] Response Formatting
- [ ] Error Handling
- [ ] Integration & Unit Tests
- [ ] Documentation Updates
- [ ] Code Review & Refactoring 