# Dashboard Metrics User Manual

This guide explains the key metrics displayed on your Factory Planning Board dashboard. Each metric helps you understand your factory's performance at a glance. Below, you'll find what each metric means, how it's calculated, and tips for interpretation.

---

## 1. Active Orders
- **What it means:**
  The number of manufacturing orders that are currently being worked on or are scheduled to start soon.
- **How it's calculated:**
  Count of all orders with a status of **"in progress"** or **"not started"**.
- **Tip:**
  A higher number may indicate a busy production floor or a backlog of work.

---

## 2. Completion Rate
- **What it means:**
  The percentage of manufacturing orders that have been completed out of all orders.
- **How it's calculated:**
  
  \[
  \text{Completion Rate} = \frac{\text{Number of Completed Orders}}{\text{Total Orders}} \times 100
  \]
- **Tip:**
  A higher completion rate means more orders are being finished. If this number is low, it may signal delays or bottlenecks.

---

## 3. Work Centre Utilization
- **What it means:**
  How much of your factory's total work centre capacity is currently being used.
- **How it's calculated:**
  
  \[
  \text{Utilization} = \frac{\text{Total Current Jobs}}{\text{Total Capacity}} \times 100
  \]
  Where:
  - **Total Current Jobs:** Sum of jobs currently assigned to all work centres.
  - **Total Capacity:** Sum of the maximum job capacity for all work centres.
- **Tip:**
  High utilization means your resources are being used efficiently, but very high values may risk overloading.

---

## 4. Daily Production
- **What it means:**
  The total number of items completed today across all orders.
- **How it's calculated:**
  Sum of `quantityCompleted` for all orders finished today (where the completion date matches today).
- **Tip:**
  Track this number against your daily target to monitor productivity.

---

## 5. Overdue Orders
- **What it means:**
  The number of manufacturing orders that have not been completed by their due date.
- **How it's calculated:**
  Count of all orders with a status of **"overdue"**.
- **Tip:**
  Overdue orders may require urgent attention to avoid delays in production schedules.

---

## 6. Average Cycle Time
- **What it means:**
  The average time (in days) it takes to complete a manufacturing order from start to finish.
- **How it's calculated:**
  Currently, this is a placeholder value (e.g., 12.5 days). In future, it will be calculated as the average duration between the start and completion dates for all completed orders.
- **Tip:**
  Lower cycle times generally indicate a more efficient production process.

---

*This manual will be updated as new metrics or calculation methods are introduced. For questions or suggestions, please contact your system administrator.* 