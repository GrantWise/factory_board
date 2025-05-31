# Factory Board Backend

Node.js/Express backend API for the Manufacturing Planning Board system.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment**
   ```bash
   cp .env.example .env
   ```

3. **Initialize Database**
   ```bash
   npm run migrate
   npm run seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

API available at `http://localhost:3001`

## Features

- RESTful API with Express.js
- SQLite database with 3NF schema
- JWT authentication with role-based access
- Real-time WebSocket updates
- Drag & drop conflict resolution
- Comprehensive audit logging
- Analytics & reporting endpoints

## Sample Users
- **admin** / password123 (full access)
- **scheduler1** / password123 (order management)
- **viewer1** / password123 (read-only)