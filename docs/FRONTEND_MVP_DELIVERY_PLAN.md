# Frontend MVP Delivery Plan

This document tracks the step-by-step plan for delivering the remaining MVP features for the Manufacturing Planning Board frontend. Each section includes a checklist, brief explanations, and space for progress notes.

---

## 1. CSV Import for Orders
**Goal:** Allow users to import manufacturing orders from a CSV file, populating the planning board without manual data entry.

### Tasks Checklist
- [ ] Design the CSV import UI (button, modal, or drag-and-drop area)
- [ ] Define the required CSV format and document it for users
- [ ] Implement CSV file parsing (using a library like `papaparse`)
- [ ] Validate CSV data (required fields, correct types, duplicates, etc.)
- [ ] Map CSV data to the ManufacturingOrder type
- [ ] Integrate imported orders into the board state (and backend if needed)
- [ ] Display success/error messages and validation feedback
- [ ] Add beginner-friendly comments and documentation
- [ ] Write simple tests for the import logic
- [ ] Update the user manual with import instructions

**Notes/Progress:**
- CSV import is a critical MVP feature for real-world usability.
- Consider sample CSV templates for users.

---

## 2. TV Mode (Display-Only View)
**Goal:** Provide a simplified, read-only view of the planning board for large screens on the shop floor.

### Tasks Checklist
- [ ] Design a minimal, high-contrast display mode (large fonts, no controls)
- [ ] Add a toggle or route for TV mode (e.g., `/tv` or a button)
- [ ] Hide all editing/drag-and-drop controls in TV mode
- [ ] Ensure auto-refresh or real-time updates for display
- [ ] Optimize layout for visibility from a distance
- [ ] Add accessibility features (contrast, font size, etc.)
- [ ] Document how to activate and use TV mode

**Notes/Progress:**
- TV mode is for display only—no user interaction required.
- Should be easy to deploy on any large screen.

---

## 3. Conflict Warnings (Lower Priority)
**Goal:** Warn users when moving jobs in ways that may cause workflow conflicts (e.g., skipping steps, moving before completion).

### Tasks Checklist
- [ ] Identify conflict scenarios (e.g., incomplete steps, status mismatches)
- [ ] Design warning dialogs or banners for conflicts
- [ ] Implement logic to detect conflicts on drag/drop
- [ ] Display clear, beginner-friendly messages and options (e.g., "Are you sure?")
- [ ] Allow users to override with confirmation
- [ ] Add comments explaining error handling
- [ ] Test conflict scenarios

**Notes/Progress:**
- Not a blocker for initial MVP, but important for user guidance.

---

## Progress Tracking
- Mark each task as `[x]` when complete.
- Add notes under each section to summarize actions taken or decisions made.
- Update this plan regularly as features are delivered.

---

**Last updated:** (fill in date as you work) 