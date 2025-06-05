# Manufacturing Planning Board - Software Requirements Specification

## Table of Contents
1. [Architectural Assessment](#architectural-assessment)
2. [System Design](#system-design)
3. [Architecture Pattern](#architecture-pattern)
4. [State Management](#state-management)
5. [Data Flow](#data-flow)
6. [Technical Stack](#technical-stack)
7. [Authentication Process](#authentication-process)
8. [Route Design](#route-design)
9. [API Design](#api-design)
10. [Database Design ERD](#database-design-erd)
11. [Performance Considerations](#performance-considerations)
12. [Future Roadmap](#future-roadmap)

---

## Architectural Assessment

### Overall Verdict ✅
**The architecture is well-designed and production-ready. The foundation is strong with only minor improvements needed rather than major restructuring.**

### Strengths
- ✅ **Excellent separation of concerns** with clear API/Frontend boundaries
- ✅ **Comprehensive validation and error handling** with centralized middleware
- ✅ **Proper authentication** with JWT and role-based permissions
- ✅ **Real-time capabilities** with WebSocket integration for collaboration
- ✅ **Database design** follows 3NF principles with proper relationships
- ✅ **Component architecture** is modular and reusable
- ✅ **API design** is RESTful with consistent error responses
- ✅ **Modern React/Node.js patterns** following 2025 best practices

### ⚠️ **IMPORTANT: MVP vs Future Optimizations**

**DO NOT IMPLEMENT THESE FOR MVP** - The current architecture is production-ready and these would add unnecessary complexity:

#### 🚫 Skip for MVP (Premature Optimization)
1. **State Management Changes**: Current React Context + local state is perfect for MVP scale
2. **Advanced Caching (Redis)**: Adds infrastructure complexity without clear benefit at current scale
3. **Connection Pooling**: SQLite with better-sqlite3 already handles this efficiently
4. **Virtual Scrolling**: Only needed for 1000+ orders (unlikely in MVP)
5. **Microservices**: Current modular monolith is ideal for MVP
6. **Load Balancers**: Single instance handles MVP traffic perfectly
7. **Advanced Bundle Splitting**: Next.js already optimizes this automatically

#### ✅ MVP-Ready Additions (Simple & Essential)
1. **Basic Error Logging**: Add structured error logging for production debugging
2. **Environment Configuration**: Ensure proper production vs development settings
3. **Health Checks**: Simple endpoint monitoring (already implemented)

**Focus for MVP**: User testing, business logic validation, and real manufacturing workflow feedback - not performance optimization.

---

## System Design

The Manufacturing Planning Board follows a **modern full-stack architecture** designed for manufacturing operations management:

### Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
│  React/Next.js + TypeScript + Tailwind CSS + dnd-kit       │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Dashboard   │  │ Planning    │  │ Orders      │         │
│  │ Components  │  │ Board       │  │ Management  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │
                    │   (CORS, Auth,    │
                    │   Rate Limiting)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                    Backend Layer                              │
│           Node.js/Express + WebSocket                        │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │Controllers  │  │ Services    │  │ Models      │           │
│  │(HTTP/WS)    │  │(Business    │  │(Data        │           │
│  │             │  │ Logic)      │  │ Access)     │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                              │                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │Middleware   │  │Validation   │  │WebSocket    │           │
│  │(Auth, RBAC) │  │(Joi Schema) │  │(Real-time)  │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                    Data Layer                                 │
│                SQLite + better-sqlite3                        │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │Manufacturing│  │Work Centres │  │Users &      │           │
│  │Orders       │  │& Machines   │  │Audit Logs   │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles
- **Separation of Concerns**: Clear boundaries between presentation, business logic, and data access
- **Scalability**: Component-based frontend with stateless backend services
- **Security**: JWT authentication with role-based access control
- **Real-time Collaboration**: WebSocket integration for live updates
- **Type Safety**: TypeScript throughout the application stack

---

## Architecture Pattern

### Primary Pattern: Layered MVC with Clean Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                 Presentation Layer                          │
│  React Components │ Custom Hooks │ Context Providers       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Application Layer                            │
│  Controllers │ Middleware │ WebSocket Handlers              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Business Layer                              │
│  Services │ Business Logic │ Validation Rules               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Data Access Layer                           │
│  Models │ Repository Pattern │ Database Abstraction         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                         │
│  SQLite Database │ File System │ External APIs              │
└─────────────────────────────────────────────────────────────┘
```

### Secondary Patterns
- **Repository Pattern**: Abstracts data access logic from business logic
- **Middleware Pattern**: Cross-cutting concerns (authentication, validation, logging)
- **Observer Pattern**: Real-time updates through WebSocket event system
- **Strategy Pattern**: Different authentication and authorization strategies
- **Factory Pattern**: Database connection and model instantiation

---

## State Management

### Frontend State Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                   Client State Layers                       │
├─────────────────────────────────────────────────────────────┤
│ Local Component State (useState/useReducer)                 │
│ • Form inputs, UI toggles, component-specific data          │
├─────────────────────────────────────────────────────────────┤
│ Global Application State (React Context)                    │
│ • User authentication, permissions, app-wide settings       │
├─────────────────────────────────────────────────────────────┤
│ Server State (Custom Hooks + API)                          │
│ • Manufacturing orders, work centres, cached API responses  │
├─────────────────────────────────────────────────────────────┤
│ Real-time State (WebSocket)                                │
│ • Live order movements, user presence, drag operations      │
└─────────────────────────────────────────────────────────────┘
```

### State Management Strategy
**Local Component State**: React `useState` and `useReducer` for:
- Form input values and validation states
- UI component visibility (modals, dropdowns)
- Component-specific loading and error states

**Global Application State**: React Context API for:
- User authentication status and user data
- Role-based permissions and access control
- Application-wide settings and preferences
- Theme and internationalization state

**Server State**: Custom hooks with API integration for:
- Manufacturing orders with filtering and pagination
- Work centres and machine configurations
- Dashboard analytics and metrics
- Cached responses with automatic revalidation

**Real-time State**: WebSocket integration for:
- Live order movements and position updates
- User presence and collaboration indicators
- Drag operation locks and conflict prevention
- Real-time notifications and system alerts

### Backend State Strategy
- **Stateless REST API**: Each HTTP request contains all necessary information
- **JWT Session Management**: User authentication state stored in signed tokens
- **In-memory Temporary State**: Drag operation locks with automatic expiration
- **Persistent Database State**: All application data stored in SQLite with ACID properties

---

## Data Flow

### Request-Response Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   React     │    │   API       │    │   Express   │    │   SQLite    │
│ Component   │    │  Service    │    │ Controller  │    │  Database   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
   1.  │ User Interaction  │                   │                   │
       ├──────────────────►│                   │                   │
   2.  │                   │ API Call          │                   │
       │                   ├──────────────────►│                   │
   3.  │                   │                   │ Auth Middleware   │
       │                   │                   ├───────────────────┤
   4.  │                   │                   │ Validation        │
       │                   │                   ├───────────────────┤
   5.  │                   │                   │ Business Logic    │
       │                   │                   ├──────────────────►│
   6.  │                   │                   │                   │ Database Query
       │                   │                   │◄──────────────────┤
   7.  │                   │ Response          │                   │ Result
       │                   │◄──────────────────┤                   │
   8.  │ State Update      │                   │                   │
       │◄──────────────────┤                   │                   │
   9.  │ UI Re-render      │                   │                   │
```

### Real-time Data Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User A    │    │  WebSocket  │    │  WebSocket  │    │   User B    │
│  (Dragging) │    │   Server    │    │   Client    │    │ (Viewing)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
   1.  │ Start Drag        │                   │                   │
       ├──────────────────►│                   │                   │
   2.  │                   │ Lock Order        │                   │
       │                   ├──────────────────►│                   │
   3.  │                   │                   │ Show Lock UI      │
       │                   │                   ├──────────────────►│
   4.  │ Complete Move     │                   │                   │
       ├──────────────────►│                   │                   │
   5.  │                   │ Update Database   │                   │
   6.  │                   │ Broadcast Move    │                   │
       │                   ├──────────────────►│                   │
   7.  │                   │                   │ Update Board      │
       │                   │                   ├──────────────────►│
```

### Data Processing Pipeline
1. **Input Validation**: Joi schemas validate and sanitize all user input
2. **Authentication**: JWT tokens verified and user permissions checked
3. **Business Logic**: Controllers delegate to service layer for processing
4. **Data Persistence**: Models handle database operations with transactions
5. **Real-time Broadcasting**: WebSocket events notify connected clients
6. **Response Formatting**: Consistent JSON responses with error handling
7. **Client State Update**: React components update based on API responses

---

## Technical Stack

### Frontend Technologies
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Stack                           │
├─────────────────────────────────────────────────────────────┤
│ React 18             │ Component-based UI library            │
│ Next.js 14           │ Full-stack React framework with SSR   │
│ TypeScript           │ Type-safe JavaScript superset         │
│ Tailwind CSS         │ Utility-first CSS framework           │
│ dnd-kit              │ Accessible drag-and-drop library      │
│ Socket.io-client     │ WebSocket client for real-time        │
│ React Hook Form      │ Performant form handling              │
│ Lucide React         │ Modern icon library                   │
│ Sonner               │ Toast notification system             │
└─────────────────────────────────────────────────────────────┘
```

### Backend Technologies
```
┌─────────────────────────────────────────────────────────────┐
│                    Backend Stack                            │
├─────────────────────────────────────────────────────────────┤
│ Node.js 18+          │ JavaScript runtime environment        │
│ Express.js           │ Web application framework             │
│ better-sqlite3       │ High-performance SQLite library       │
│ Socket.io            │ Real-time WebSocket communication     │
│ JWT (jsonwebtoken)   │ Stateless authentication tokens      │
│ bcryptjs             │ Password hashing and encryption       │
│ Joi                  │ Input validation and sanitization     │
│ Helmet               │ Security headers and protection       │
│ CORS                 │ Cross-origin resource sharing         │
│ Express Rate Limit   │ API rate limiting and DDoS protection │
└─────────────────────────────────────────────────────────────┘
```

### Development & Operations
```
┌─────────────────────────────────────────────────────────────┐
│                 DevOps & Tooling                            │
├─────────────────────────────────────────────────────────────┤
│ TypeScript           │ Type safety across full stack         │
│ ESLint + Prettier    │ Code quality and consistent formatting │
│ Jest                 │ JavaScript testing framework          │
│ React Testing Library│ Component testing utilities           │
│ Supertest            │ API endpoint testing                  │
│ Nodemon              │ Development server auto-restart       │
│ dotenv               │ Environment variable management       │
│ PM2                  │ Production process management         │
└─────────────────────────────────────────────────────────────┘
```

### Database & Storage
```
┌─────────────────────────────────────────────────────────────┐
│                Database Architecture                        │
├─────────────────────────────────────────────────────────────┤
│ SQLite               │ Embedded relational database          │
│ better-sqlite3       │ Synchronous Node.js SQLite driver     │
│ WAL Mode             │ Write-Ahead Logging for performance   │
│ Foreign Keys         │ Referential integrity enforcement     │
│ 3NF Normalization    │ Optimized schema design              │
│ Automatic Migrations │ Database schema version management    │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Process

### JWT-based Authentication Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │   Auth      │    │   JWT       │    │  Database   │
│ Application │    │Middleware   │    │  Service    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
   1.  │ Login Request     │                   │                   │
       ├──────────────────►│                   │                   │
   2.  │                   │ Validate Creds    │                   │
       │                   ├──────────────────►│                   │
   3.  │                   │                   │ Check User        │
       │                   │                   ├──────────────────►│
   4.  │                   │                   │ User Data         │
       │                   │                   │◄──────────────────┤
   5.  │                   │ Generate Tokens   │                   │
       │                   │◄──────────────────┤                   │
   6.  │ Access + Refresh  │                   │                   │
       │◄──────────────────┤                   │                   │
   7.  │ API Request       │                   │                   │
       ├──────────────────►│                   │                   │
   8.  │                   │ Verify Token      │                   │
       │                   ├──────────────────►│                   │
   9.  │                   │ Valid/User Info   │                   │
       │                   │◄──────────────────┤                   │
  10.  │ Authorized Access │                   │                   │
       │◄──────────────────┤                   │                   │
```

### Security Implementation
**Password Security**:
- bcryptjs with 12 salt rounds for password hashing
- Automatic password strength validation
- Secure password reset with time-limited tokens

**Token Management**:
- JWT access tokens (24-hour expiration)
- Refresh tokens (7-day expiration)
- Automatic token refresh before expiration
- Secure token storage (httpOnly cookies for production)

**API Security**:
- Rate limiting: 100 requests/15 minutes per IP
- Auth rate limiting: 5 attempts/15 minutes for login
- CORS configuration with specific allowed origins
- Helmet.js for security headers
- Input validation and sanitization on all endpoints

**Role-Based Access Control (RBAC)**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Permission Matrix                        │
├─────────────────┬─────────────┬─────────────┬─────────────────┤
│ Resource        │ Admin       │ Scheduler   │ Viewer          │
├─────────────────┼─────────────┼─────────────┼─────────────────┤
│ Users           │ CRUD        │ -           │ -               │
│ Work Centres    │ CRUD        │ Read        │ Read            │
│ Orders          │ CRUD + Move │ CRU + Move  │ Read            │
│ Analytics       │ Read        │ Read        │ Read            │
│ Settings        │ Write       │ -           │ -               │
│ Audit Logs      │ Read        │ -           │ -               │
└─────────────────┴─────────────┴─────────────┴─────────────────┘
```

---

## Route Design

### Frontend Routes (Next.js App Router)
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Routing                         │
├─────────────────────────────────────────────────────────────┤
│ /                    │ Login page (public)                  │
│ /dashboard           │ Main dashboard with planning board   │
│ /orders              │ Orders management table              │
│ /work-centres        │ Work centre configuration            │
│ /analytics           │ Analytics and reporting              │
│ /settings            │ Application settings                 │
├─────────────────────────────────────────────────────────────┤
│ Route Protection:                                           │
│ • Public routes: /, /login                                  │
│ • Protected routes: All others require authentication       │
│ • Role-based access: Admin features restricted by role      │
└─────────────────────────────────────────────────────────────┘
```

### API Routes (Express.js)
```
┌─────────────────────────────────────────────────────────────┐
│                     API Endpoints                           │
├─────────────────────────────────────────────────────────────┤
│ Authentication:                                             │
│ POST   /api/auth/login          │ User login                │
│ POST   /api/auth/logout         │ User logout               │
│ POST   /api/auth/refresh        │ Refresh access token      │
│ GET    /api/auth/me             │ Get current user          │
│ PUT    /api/auth/profile        │ Update user profile       │
│ POST   /api/auth/change-password│ Change password           │
├─────────────────────────────────────────────────────────────┤
│ Manufacturing Orders:                                       │
│ GET    /api/orders              │ List with filtering       │
│ POST   /api/orders              │ Create new order          │
│ GET    /api/orders/:id          │ Get specific order        │
│ PUT    /api/orders/:id          │ Update order              │
│ DELETE /api/orders/:id          │ Delete order              │
│ PUT    /api/orders/:id/move     │ Move between work centres │
│ POST   /api/orders/:id/start-move│ Lock for drag operation  │
│ POST   /api/orders/:id/end-move │ Release drag lock         │
├─────────────────────────────────────────────────────────────┤
│ Work Centres:                                               │
│ GET    /api/work-centres        │ List all work centres     │
│ POST   /api/work-centres        │ Create work centre        │
│ PUT    /api/work-centres/:id    │ Update work centre        │
│ DELETE /api/work-centres/:id    │ Delete work centre        │
│ PUT    /api/work-centres/reorder│ Reorder columns           │
├─────────────────────────────────────────────────────────────┤
│ Planning Board:                                             │
│ GET    /api/planning-board      │ Get complete board state  │
│ PUT    /api/planning-board/move │ Move order alternative    │
│ GET    /api/planning-board/stats│ Board statistics          │
├─────────────────────────────────────────────────────────────┤
│ Analytics:                                                  │
│ GET    /api/analytics/dashboard │ Dashboard metrics         │
│ GET    /api/analytics/cycle-times│ Cycle time analysis      │
│ GET    /api/analytics/work-centres│ Work centre performance │
└─────────────────────────────────────────────────────────────┘
```

### WebSocket Events
```
┌─────────────────────────────────────────────────────────────┐
│                  Real-time Events                           │
├─────────────────────────────────────────────────────────────┤
│ Client → Server:                                            │
│ • join_planning_board    │ Join collaborative session      │
│ • leave_planning_board   │ Leave collaborative session     │
│ • start_drag            │ Begin order drag operation       │
│ • end_drag              │ Complete drag operation          │
├─────────────────────────────────────────────────────────────┤
│ Server → Client:                                            │
│ • user_joined           │ User joined planning board       │
│ • user_left             │ User left planning board         │
│ • order_locked          │ Order locked by another user     │
│ • order_unlocked        │ Order lock released              │
│ • order_moved           │ Order position changed           │
│ • order_updated         │ Order data modified              │
│ • work_centre_updated   │ Work centre configuration changed │
└─────────────────────────────────────────────────────────────┘
```

---

## API Design

### RESTful Design Principles
**Resource-based URLs**: Clean, intuitive endpoint structure
- ✅ `/api/orders/123` 
- ❌ `/api/getOrder?id=123`

**HTTP Method Semantics**:
- `GET`: Retrieve resources (idempotent, cacheable)
- `POST`: Create new resources (non-idempotent)
- `PUT`: Update entire resources (idempotent)
- `PATCH`: Partial updates (idempotent)
- `DELETE`: Remove resources (idempotent)

### Consistent Response Format
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "count": 25
  },
  "message": "Orders retrieved successfully",
  "timestamp": "2025-06-01T12:00:00Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "order_number": "Order number is required",
    "quantity_to_make": "Must be a positive integer"
  },
  "timestamp": "2025-06-01T12:00:00Z"
}
```

### HTTP Status Codes
```
┌─────────────────────────────────────────────────────────────┐
│                  Status Code Usage                          │
├─────────────────────────────────────────────────────────────┤
│ 200 OK              │ Successful GET, PUT, PATCH            │
│ 201 Created         │ Successful POST (resource created)    │
│ 204 No Content      │ Successful DELETE                     │
│ 400 Bad Request     │ Invalid input/validation errors       │
│ 401 Unauthorized    │ Missing or invalid authentication     │
│ 403 Forbidden       │ Insufficient permissions              │
│ 404 Not Found       │ Resource doesn't exist                │
│ 409 Conflict        │ Resource conflict (duplicate)         │
│ 422 Unprocessable   │ Valid format, invalid business logic  │
│ 423 Locked          │ Resource locked by another user       │
│ 429 Too Many Requests│ Rate limit exceeded                  │
│ 500 Internal Error  │ Server error                          │
└─────────────────────────────────────────────────────────────┘
```

### Request/Response Examples

**Create Manufacturing Order**:
```http
POST /api/orders
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "order_number": "MO-2024-001",
  "stock_code": "WIDGET-A01",
  "description": "Premium Widget Assembly",
  "quantity_to_make": 500,
  "current_work_centre_id": 2,
  "priority": "high",
  "due_date": "2024-06-15",
  "manufacturing_steps": [
    {
      "step_number": 1,
      "operation_name": "Cutting",
      "work_centre_id": 1
    },
    {
      "step_number": 2,
      "operation_name": "Assembly",
      "work_centre_id": 2
    }
  ]
}
```

**Move Order Between Work Centres**:
```http
PUT /api/orders/123/move
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "to_work_centre_id": 3,
  "reason": "user_decision"
}
```

### Validation Schema (Joi)
```javascript
const orderSchema = Joi.object({
  order_number: Joi.string().max(50).required(),
  stock_code: Joi.string().max(50).required(),
  description: Joi.string().required(),
  quantity_to_make: Joi.number().integer().min(1).required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  due_date: Joi.string().isoDate().optional()
});
```

---

## Database Design ERD

### Entity Relationship Diagram
```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│     Users       │       │  Manufacturing   │       │  Work Centres   │
├─────────────────┤       │     Orders       │       ├─────────────────┤
│ id (PK)         │       ├──────────────────┤       │ id (PK)         │
│ username (UQ)   │◄──────┤ created_by (FK)  │       │ name            │
│ email (UQ)      │       │ order_number (UQ)│       │ code (UNIQUE)   │
│ password_hash   │       │ stock_code       │       │ description     │
│ role            │       │ description      │   ┌───┤ capacity        │
│ first_name      │       │ quantity_to_make │   │   │ display_order   │
│ last_name       │       │ quantity_complete│   │   │ is_active       │
│ is_active       │       │ current_operation│   │   │ created_at      │
│ created_at      │       │ status           │   │   │ updated_at      │
│ updated_at      │       │ priority         │   │   └─────────────────┘
└─────────────────┘       │ due_date         │   │
                          │ start_date       │   │   ┌─────────────────┐
┌─────────────────┐       │ completion_date  │   │   │ Manufacturing   │
│   Audit Log     │       │ current_work_    │   │   │     Steps       │
├─────────────────┤       │ centre_id (FK)   │───┘   ├─────────────────┤
│ id (PK)         │   ┌───┤ created_at       │       │ id (PK)         │
│ event_type      │   │   │ updated_at       │       │ order_id (FK)   │◄─┐
│ order_id (FK)   │───┘   └──────────────────┘       │ step_number     │  │
│ from_wc_id (FK) │                                  │ operation_name  │  │
│ to_wc_id (FK)   │       ┌──────────────────┐       │ work_centre_id  │──┘
│ user_id (FK)    │       │    Machines      │       │ status          │
│ event_data (JSON)      ├──────────────────┤       │ planned_duration│
│ queue_depth_from│   ┌───┤ work_centre_id   │       │ actual_duration │
│ queue_depth_to  │   │   │ name             │       │ quantity_complete│
│ timestamp       │   │   │ code (UQ)        │       │ started_at      │
└─────────────────┘   │   │ description      │       │ completed_at    │
                      │   │ is_active        │       │ created_at      │
                      │   │ created_at       │       │ updated_at      │
                      │   │ updated_at       │       └─────────────────┘
                      │   └──────────────────┘
                      │
                      └─── ┌─────────────────┐
                           │ Scanner Events  │
                           ├─────────────────┤
                           │ id (PK)         │
                           │ order_id (FK)   │
                           │ work_centre_id  │
                           │ event_type      │
                           │ quantity        │
                           │ operator_badge  │
                           │ scanner_id      │
                           │ timestamp       │
                           │ processed       │
                           └─────────────────┘
```

### Table Specifications

**Users Table**:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'scheduler', 'viewer') NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Work Centres Table**:
```sql
CREATE TABLE work_centres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Manufacturing Orders Table**:
```sql
CREATE TABLE manufacturing_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    stock_code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity_to_make INTEGER NOT NULL,
    quantity_completed INTEGER DEFAULT 0,
    current_operation VARCHAR(100),
    current_work_centre_id INTEGER,
    status ENUM('not_started', 'in_progress', 'complete', 'on_hold', 'cancelled') DEFAULT 'not_started',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    due_date DATE,
    start_date DATE,
    completion_date DATE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**Manufacturing Steps Table**:
```sql
CREATE TABLE manufacturing_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    work_centre_id INTEGER NOT NULL,
    status ENUM('pending', 'in_progress', 'complete', 'skipped') DEFAULT 'pending',
    planned_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    quantity_completed INTEGER DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id),
    UNIQUE(order_id, step_number)
);
```

**Audit Log Table**:
```sql
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(50) NOT NULL,
    order_id INTEGER,
    from_work_centre_id INTEGER,
    to_work_centre_id INTEGER,
    user_id INTEGER,
    event_data JSON,
    queue_depth_from INTEGER,
    queue_depth_to INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES manufacturing_orders(id),
    FOREIGN KEY (from_work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (to_work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Database Relationships
- **One-to-Many**: Users → Manufacturing Orders (created_by)
- **One-to-Many**: Work Centres → Manufacturing Orders (current_work_centre_id)
- **One-to-Many**: Work Centres → Machines (work_centre_id)
- **One-to-Many**: Manufacturing Orders → Manufacturing Steps (order_id)
- **Many-to-One**: Manufacturing Steps → Work Centres (work_centre_id)
- **One-to-Many**: All entities → Audit Log (comprehensive activity tracking)

### Database Features
- **3NF Normalization**: Eliminates data redundancy and ensures data integrity
- **Foreign Key Constraints**: Maintains referential integrity across tables
- **Indexes**: Optimized queries on frequently accessed columns
- **Audit Trail**: Complete history of all order movements and changes
- **Soft Deletes**: Maintains data history using `is_active` flags
- **WAL Mode**: Write-Ahead Logging for improved performance and concurrency

---

## Performance Considerations

### 🎯 **MVP Performance Strategy: Current Architecture is Sufficient**

**CRITICAL NOTE**: The existing implementation is already optimized for MVP and initial production use. The following optimizations should **only** be considered when you have clear performance issues or have reached significant scale (500+ orders, 50+ concurrent users).

### Current Architecture Performance Capabilities
- **SQLite + better-sqlite3**: Handles 2000+ queries/second, 100,000+ orders
- **React Context**: Efficiently manages state for 10-50 components
- **WebSocket**: Supports 100+ concurrent users for real-time collaboration
- **Next.js**: Built-in optimizations handle typical manufacturing facility loads

### ⚠️ **Future Optimizations (NOT for MVP)**
The following should only be implemented when experiencing actual performance bottlenecks:

#### Frontend Optimization (Implement Only When Needed)
```
┌─────────────────────────────────────────────────────────────┐
│           Future Frontend Performance (NOT MVP)             │
├─────────────────────────────────────────────────────────────┤
│ React Optimization:                                         │
│ • Virtual scrolling (1000+ orders only)                     │
│ • Advanced memo strategies (complex UI only)                │
│ • Custom bundle splitting (large teams only)                │
│ • Service workers (offline requirements only)               │
├─────────────────────────────────────────────────────────────┤
│ When to Implement:                                          │
│ • User complaints about slow rendering                      │
│ • Browser performance profiling shows bottlenecks          │
│ • Managing >500 orders simultaneously                      │
└─────────────────────────────────────────────────────────────┘
```

#### Backend Optimization (Scale-Driven Only)
```
┌─────────────────────────────────────────────────────────────┐
│           Future Backend Performance (NOT MVP)              │
├─────────────────────────────────────────────────────────────┤
│ Database Scaling:                                           │
│ • Redis caching (>50 concurrent users)                      │
│ • Connection pooling (high-frequency queries)               │
│ • Read replicas (read-heavy workloads)                      │
│ • PostgreSQL migration (multi-tenant requirements)          │
├─────────────────────────────────────────────────────────────┤
│ API Scaling:                                                │
│ • Load balancing (multiple server instances)                │
│ • Advanced caching strategies (CDN, edge computing)         │
│ • Microservices (large development teams)                   │
└─────────────────────────────────────────────────────────────┘
```

### ✅ **MVP Performance Checklist (Simple & Essential)**
These are the ONLY performance-related items needed for MVP:

1. **Basic Error Logging** (Already Implemented):
   ```javascript
   // Existing centralized error handler is sufficient
   console.error('Server Error:', err);
   ```

2. **Environment Optimization** (Already Implemented):
   ```javascript
   // NODE_ENV checks already in place
   app.use(helmet()); // Security headers
   ```

3. **Database Indexes** (Already Implemented):
   ```sql
   -- Existing indexes on frequently queried columns
   CREATE INDEX idx_orders_status ON manufacturing_orders(status);
   ```

### 🚨 **Developer Guidance: Focus on Features, Not Optimization**

**For MVP Development Teams**:
- ✅ Focus on user experience and business logic
- ✅ Implement manufacturing workflow features
- ✅ Test with real production data
- ❌ Do NOT implement caching layers
- ❌ Do NOT refactor state management
- ❌ Do NOT add performance monitoring tools

**Performance optimization should be data-driven, not assumption-driven.**

---

## Future Roadmap

### Phase 1: Foundation Enhancement (Months 1-3)
- ✅ **Current State**: Solid MVP with core functionality
- 🔄 **Improvements**: Performance optimization and monitoring
- 📋 **Add**: Enhanced testing coverage and documentation

### Phase 2: Intelligence Layer (Months 4-9)
- 🤖 **Smart Routing**: ML-based routing suggestions
- 📊 **Predictive Analytics**: Queue time and bottleneck predictions
- 🧠 **Learning System**: Automatic pattern recognition from user decisions
- 📈 **Advanced Analytics**: Cycle time analysis and optimization recommendations

### Phase 3: OEE Integration (Months 10-15)
- 🏭 **Machine Integration**: Real-time machine data via MQTT
- 📊 **OEE Metrics**: Availability, Performance, Quality tracking
- 🔍 **Predictive Maintenance**: Machine health monitoring and alerts
- 🎯 **Production Optimization**: Automated capacity planning and scheduling

### Phase 4: Enterprise Features (Months 16-24)
- 🏢 **Multi-tenant Architecture**: Support for multiple facilities
- 🔗 **ERP Integration**: SAP, Oracle, Microsoft Dynamics connectors
- 📱 **Mobile Applications**: Native iOS/Android apps for operators
- 🌐 **Multi-language Support**: Internationalization and localization

### Technology Evolution Path
```
┌─────────────────────────────────────────────────────────────┐
│                Technology Roadmap                           │
├─────────────────────────────────────────────────────────────┤
│ Database Evolution:                                         │
│ SQLite → PostgreSQL → Distributed Database (Phase 4)        │
├─────────────────────────────────────────────────────────────┤
│ Architecture Evolution:                                     │
│ Monolith → Modular Monolith → Microservices (Phase 3-4)    │
├─────────────────────────────────────────────────────────────┤
│ Intelligence Evolution:                                     │
│ Rules-based → ML/AI → Autonomous Optimization (Phase 2-4)   │
├─────────────────────────────────────────────────────────────┤
│ Integration Evolution:                                      │
│ API-first → Event-driven → Real-time Streaming (Phase 2-3)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Conclusion

### Architectural Strength Assessment
Your Manufacturing Planning Board has a **solid architectural foundation** that properly separates concerns, implements security best practices, and provides real-time collaboration capabilities. The current implementation follows modern development patterns and is well-positioned for future enhancements.

### Key Architectural Decisions Validated
- ✅ **Component-based React architecture** enables modular development and reusability
- ✅ **Express.js with middleware pattern** provides flexible and maintainable backend structure
- ✅ **SQLite with better-sqlite3** offers excellent performance for current scale
- ✅ **JWT-based authentication** provides stateless, scalable security
- ✅ **WebSocket integration** enables real-time collaboration features
- ✅ **TypeScript throughout** ensures type safety and developer productivity

### Recommended Next Steps
1. **User Testing & Feedback**: Deploy MVP and gather real manufacturing workflow feedback
2. **Business Logic Validation**: Ensure work center rules and order flows match actual operations
3. **Data Integration**: Test CSV import with real manufacturing data
4. **Mobile Optimization**: Validate tablet usage for factory floor operations
5. **Documentation**: Complete user guides and deployment instructions

**Performance optimization should only be considered after MVP validation and real user feedback. The current architecture handles typical manufacturing facility loads efficiently.**

The architecture provides an excellent foundation for both current operations and future intelligent manufacturing capabilities outlined in your roadmap.

---

*This Software Requirements Specification serves as the comprehensive technical blueprint for the Manufacturing Planning Board system, ensuring consistent development practices and architectural decisions.*