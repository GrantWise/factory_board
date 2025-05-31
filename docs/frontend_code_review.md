# Frontend Code Review Summary

## Project Overview
This document summarizes the current state of the frontend for the factory_board project, highlights strengths, identifies actionable improvements, and provides guidance for future extensibility. It is intended as a clear, actionable reference for the development team.

---

## What the Frontend Does
- Provides a React/Next.js interface for managing manufacturing operations.
- Main features include:
  - Dashboard overview with analytics and recent activity.
  - Planning board with drag-and-drop order management across work centres.
  - Work centre management (add, edit, delete, reorder, activate/deactivate).
  - Orders table with search, filter, and progress tracking.
  - Theming, navigation, and user feedback (toasts, loading spinners).

---

## Strengths
- **Modular, readable code** with clear separation of concerns.
- **Consistent use of UI primitives** and design system components.
- **Good error handling** for API interactions, with user-friendly messages.
- **Descriptive variable and function names** throughout.
- **Live data updates** and real-time features (e.g., WebSocket integration in planning board).

---

## Areas for Improvement
- **Documentation & Comments:** Add/expand docstrings and inline comments, especially for complex logic and expected prop shapes.
- **Import Consistency:** Standardize on absolute imports for all internal modules.
- **Accessibility:** Add ARIA roles and keyboard navigation to interactive components.
- **Validation & User Input:** Ensure all user input is validated before backend submission; add tests for validation logic.
- **Error Handling:** Add more detailed error logging and review all API interactions for robust error handling.
- **UI Functionality:** Address all missing or placeholder UI features (see table below).
- **Legacy Adapters:** Document the purpose and usage of legacy data adapters.

---

## TODO List (Prioritized)

### Documentation & Comments
- [ ] Add top-level docstrings to all major components (Dashboard, PlanningBoard, OrdersTable, WorkCentresManagement, DashboardOverview).
- [ ] Add inline comments explaining complex logic, especially:
  - Drag-and-drop in PlanningBoard and WorkCentresManagement
  - Real-time updates and locking mechanisms
  - Filtering and analytics calculations
- [ ] Document expected prop shapes for all major components.
- [ ] Add a high-level README or overview for the frontend structure and main features.

### Import Consistency
- [ ] Refactor all internal imports to use absolute paths for clarity and consistency.

### Accessibility
- [ ] Review all interactive components for accessibility (ARIA roles, keyboard navigation, focus management).
- [ ] Add ARIA attributes and keyboard support to drag-and-drop and dialog components.

### Validation & User Input Testing
- [ ] Ensure all user input is validated on the frontend before sending to the backend (e.g., forms for work centre creation/editing, order moves).
- [ ] Add tests for all validation logic and user input handling, especially where backend interaction occurs.
- [ ] Document validation strategies and error messages for maintainers.

### Error Handling
- [ ] Add more detailed error logging (in addition to user toasts) for debugging purposes.
- [ ] Review all API interactions to ensure errors are handled gracefully and informatively.

### Legacy Adapters
- [ ] Add documentation explaining the purpose and usage of legacy data adapters.

### UI Functionality
- [ ] Implement "View Details" for work centre in Planning Board (modal or details page).
- [ ] Implement "Clear All Jobs" for work centre in Planning Board (define expected behavior).
- [ ] Implement Export functionality in Orders Table (CSV/Excel export or print).
- [ ] Add order creation dialog/form (triggered from Dashboard or Orders Table).
- [ ] Implement Analytics and Settings pages (define and build required features).
- [ ] Ensure drag-and-drop reordering of work centres is always synced to backend (auto-save or prompt to save).
- [ ] Review all other buttons/icons for missing handlers and add TODOs as needed.

---

## API Mapping: Frontend to Backend

### Authentication
- `/auth/login` (POST) — Login
- `/auth/register` (POST) — Register
- `/auth/logout` (POST) — Logout
- `/auth/me` (GET) — Get current user
- `/auth/refresh` (POST) — Refresh token
- `/auth/profile` (PUT) — Update profile
- `/auth/change-password` (POST) — Change password

### Orders
- `/orders` (GET) — List all orders (with optional filters)
- `/orders/:id` (GET) — Get order by ID
- `/orders` (POST) — Create order
- `/orders/:id` (PUT) — Update order
- `/orders/:id` (DELETE) — Delete order
- `/orders/:id/move` (PUT) — Move order to another work centre
- `/orders/:id/start-move` (POST) — Start moving order (locking)
- `/orders/:id/end-move` (POST) — End moving order (unlocking)
- `/orders/:id/steps` (GET) — Get steps for an order
- `/orders/:orderId/steps/:stepId/start` (POST) — Start a step
- `/orders/:orderId/steps/:stepId/complete` (POST) — Complete a step

### Work Centres
- `/work-centres` (GET) — List all work centres (optionally include inactive)
- `/work-centres/:id` (GET) — Get work centre by ID
- `/work-centres` (POST) — Create work centre
- `/work-centres/:id` (PUT) — Update work centre
- `/work-centres/:id` (DELETE) — Delete work centre
- `/work-centres/reorder` (PUT) — Reorder work centres
- `/work-centres/:workCentreId/machines` (POST) — Add machine
- `/work-centres/:workCentreId/machines/:machineId` (PUT) — Update machine
- `/work-centres/:workCentreId/machines/:machineId` (DELETE) — Delete machine

### Planning Board
- `/planning-board` (GET) — Get planning board data
- `/planning-board/move` (PUT) — Move order (alternative to `/orders/:id/move`)
- `/planning-board/stats` (GET) — Get planning board stats

### Analytics
- `/analytics/dashboard` (GET) — Dashboard metrics
- `/analytics/work-centres` (GET) — Work centre analytics
- `/analytics/work-centres/:id` (GET) — Analytics for a specific work centre
- `/analytics/orders` (GET) — Order analytics
- `/analytics/production` (GET) — Production metrics

---

## UI Elements with Missing or Placeholder Functionality

| Component/Location         | UI Element/Button/Icon         | Current State         | Required Action/Functionality         |
|---------------------------|-------------------------------|----------------------|---------------------------------------|
| Planning Board            | Settings (Work Centre column) | Dropdown:            | Implement "View Details" (modal/page) |
|                           | - View Details                | No functionality     | Implement "Clear All Jobs" (define behavior: cancel/move/delete jobs) |
| Orders Table              | Export                        | No functionality     | Implement CSV/Excel export or print   |
| Dashboard Overview        | Add New Order                 | Navigates to orders  | Add order creation dialog/form        |
| Analytics Page            | Entire page                   | Placeholder          | Implement analytics features          |
| Settings Page             | Entire page                   | Placeholder          | Implement settings features           |
| Work Centres Management   | Drag-and-drop reorder         | UI only, may not sync| Ensure backend sync always            |

---

## Actionable TODOs
- [ ] Add top-level docstrings and inline comments to all major components, especially for complex logic and prop shapes.
- [ ] Refactor all internal imports to use absolute paths.
- [ ] Add ARIA roles and keyboard navigation to all interactive components.
- [ ] Validate all user input before backend submission; add tests for validation logic.
- [ ] Add detailed error logging and review all API interactions for robust error handling.
- [ ] Implement missing UI features as specified in the table above.
- [ ] Document the purpose and usage of legacy data adapters.
- [ ] Review and update this document as improvements are made or new issues are discovered.

---

## Extensibility Guidance
- Design new components and features to be modular and reusable.
- Use clear, documented interfaces for API calls and context providers.
- When adding new pages/routes, follow the existing structure and document the process.
- Ensure all new modules are well-documented and follow the same validation, error handling, and accessibility standards.

---

## Notes
- UI testing is not a current priority, except for validation and user input, particularly where backend interaction occurs.
- This document is a living reference and should be updated as the project evolves.

---

*This document should be updated as improvements are made or new issues are discovered.* 