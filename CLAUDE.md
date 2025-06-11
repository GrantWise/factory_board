# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a manufacturing planning board system with a Next.js 15 frontend and Node.js/Express backend using TypeScript, Tailwind CSS, and shadcn/ui components.

## Commands

### Root Level (Monorepo)
- `npm run dev` - Start both frontend (port 3000) and backend (port 3001)
- `npm run install:all` - Install dependencies for all workspaces
- `npm run build` - Build both frontend and backend
- `npm run clean` - Remove all node_modules

### Frontend (Next.js)
- `cd frontend && npm run dev` - Start development server on port 3000
- `cd frontend && npm run build` - Build production bundle
- `cd frontend && npm run lint` - Run ESLint and TypeScript checks
- `npx shadcn@latest add [component]` - Add shadcn/ui components

### Backend (Node.js/Express)
- `cd backend && npm run dev` - Start development server on port 3001
- `cd backend && npm run migrate` - Run database migrations
- `cd backend && npm run seed` - Seed database with sample data
- `cd backend && npm test` - Run Jest tests
- `cd backend && npm run lint` - Run ESLint

## Architecture

**Frontend** (`frontend/src/`):
- `app/` - Next.js App Router pages and layouts
- `components/` - React components (shadcn/ui + custom manufacturing components)
- `lib/` - API services, utilities, and error handling
- `types/` - TypeScript type definitions for manufacturing domain
- `contexts/` - React contexts (auth, websocket)
- `hooks/` - Custom React hooks

**Backend** (`backend/src/`):
- `controllers/` - Route handlers for REST API endpoints
- `models/` - Database models (SQLite with better-sqlite3)
- `middleware/` - Authentication, validation, error handling
- `routes/` - Express route definitions
- `services/` - Business logic and WebSocket handling
- `utils/` - Database utilities and logging

**Key Features:**
- JWT authentication with role-based access (admin, scheduler, viewer)
- Real-time updates via WebSocket (Socket.IO)
- Manufacturing order management with drag-and-drop kanban board
- Work centre management and analytics
- API key management for external integrations
- Comprehensive audit logging

## Code Standards

### TypeScript/React
- Use TypeScript strict mode
- Functional components with hooks
- shadcn/ui components with Tailwind CSS utilities
- **IMPORTANT**: Always run `npm run lint` in frontend/ before committing

### Node.js/Express
- Use modern JavaScript with CommonJS modules
- SQLite database with normalized schema
- Express middleware pattern for route handling
- **IMPORTANT**: Always run `npm run lint` in backend/ before committing
- Include tests for new API endpoints

## Database

- SQLite database located at `backend/database/factory_board.db`
- Migrations in `backend/database/migrate.js`
- Sample data seeding in `backend/database/seed.js`
- Key tables: users, manufacturing_orders, work_centres, audit_logs

## Authentication

Sample users for development:
- **admin** / password123 (full access)
- **scheduler1** / password123 (order management)  
- **viewer1** / password123 (read-only)