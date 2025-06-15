# Manufacturing Planning Board - Backend API

A comprehensive Node.js/Express API for managing manufacturing orders, work centres, and production planning workflows.

## Features

- **Manufacturing Order Management**: Create, update, track manufacturing orders through production
- **Work Centre Management**: Configure and manage production work centres and machines
- **Real-time Planning Board**: Drag-and-drop kanban-style planning interface with WebSocket updates
- **User Management**: Role-based access control (admin, scheduler, viewer)
- **API Key Authentication**: Secure external system integration
- **Comprehensive Analytics**: Production metrics, utilization tracking, performance analytics
- **Audit Logging**: Complete audit trail of all system operations
- **Import/Export**: Bulk operations for manufacturing orders

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: SQLite with better-sqlite3 (production-ready)
- **Authentication**: JWT tokens + API keys
- **Real-time**: Socket.IO WebSocket connections
- **Validation**: Joi schema validation
- **Testing**: Jest with Supertest
- **Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet, CORS, rate limiting

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm 8 or higher

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd factory_board/backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Seed with sample data (optional)
npm run seed

# Start development server
npm run dev
```

The API will be available at `http://localhost:3001`

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_PATH=./database/manufacturing.db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL=INFO
```

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start with nodemon (auto-restart)
npm start           # Start production server

# Database
npm run migrate     # Run database migrations
npm run seed        # Populate with sample data

# Testing
npm test           # Run all tests
npm run test:watch # Run tests in watch mode

# Code Quality
npm run lint       # Run ESLint
npm run format     # Format code with Prettier
```

### Project Structure

```
backend/
├── src/
│   ├── app.js              # Main application entry point
│   ├── config/             # Configuration files
│   │   ├── database.js     # Database configuration
│   │   ├── constants.js    # Application constants
│   │   └── swagger.js      # API documentation config
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Express middleware
│   ├── models/             # Data models and database logic
│   ├── routes/             # Route definitions
│   ├── services/           # Business logic services
│   ├── utils/              # Utility functions
│   └── websocket/          # WebSocket handlers
├── database/
│   ├── migrations/         # Database schema migrations
│   └── seeds/             # Sample data
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── helpers/           # Test utilities
├── docs/                  # Documentation
└── uploads/               # File upload directory
```

### API Documentation

- **Interactive Documentation**: http://localhost:3001/api/docs
- **JSON Schema**: http://localhost:3001/api/docs.json
- **API Overview**: [docs/API_OVERVIEW.md](./docs/API_OVERVIEW.md)
- **Error Handling**: [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md)

## Testing

The project includes comprehensive test suites:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/unit/
npm test -- tests/integration/

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/basic.test.js
```

### Test Database

Tests use an in-memory SQLite database that's automatically set up and torn down for each test suite.

## Database

### Schema Management

Database schema is managed through migrations in `database/migrations/`:

```bash
# Run all pending migrations
npm run migrate

# Create new migration
# Add SQL file to database/migrations/ with format: XXX_description.sql
```

### Sample Data

Load sample data for development:

```bash
npm run seed
```

This creates:
- Sample users (admin, scheduler, viewer)
- Work centres with machines
- Manufacturing orders in various states
- Audit log entries

## Authentication

### JWT Tokens (Web App)

```javascript
// Login
POST /api/auth/login
{
  "username": "admin",
  "password": "password123"
}

// Use token in subsequent requests
Authorization: Bearer <access_token>
```

### API Keys (External Systems)

```javascript
// Create API key (admin only)
POST /api/admin/api-keys
{
  "system_id": "external-erp",
  "description": "ERP System Integration",
  "permissions": ["orders:read", "orders:write"]
}

// Use API key
X-API-Key: <api_key>
X-System-ID: external-erp
```

## Sample Users

- **admin** / password123 (full access)
- **scheduler1** / password123 (order management)  
- **viewer1** / password123 (read-only)

## Production Deployment

### 1. Environment Setup

```bash
# Set production environment
NODE_ENV=production

# Use strong JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Configure production database
DATABASE_PATH=/var/lib/factory-board/production.db

# Set appropriate rate limits
RATE_LIMIT_MAX_REQUESTS=500
```

### 2. Database Setup

```bash
# Run migrations
npm run migrate

# Ensure database directory permissions
chown -R app:app /var/lib/factory-board/
chmod 755 /var/lib/factory-board/
```

### 3. Process Management

Use PM2 or similar for process management:

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/app.js --name factory-board-api

# Save PM2 configuration
pm2 save
pm2 startup
```

## Security

### Best Practices Implemented

- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control
- **Input Validation**: Joi schema validation on all inputs
- **SQL Injection Prevention**: Prepared statements
- **Rate Limiting**: Configurable per endpoint
- **Security Headers**: Helmet.js middleware
- **CORS**: Configurable cross-origin policies
- **API Key Management**: Secure external system access

## Troubleshooting

### Common Issues

**Database locked error:**
```bash
# Stop the application and remove lock files
rm database/*.db-wal database/*.db-shm
```

**Port already in use:**
```bash
# Find and kill process using port 3001
lsof -ti:3001 | xargs kill -9
```

**Migration errors:**
```bash
# Reset database (development only)
rm database/manufacturing.db
npm run migrate
npm run seed
```

**Test failures:**
```bash
# Clean test artifacts
rm -f tests/test.db*
npm test
```

## Contributing

### Code Standards

- **ESLint**: Enforced code standards
- **Prettier**: Consistent code formatting
- **JSDoc**: Required for public functions
- **Testing**: Tests required for new features
- **Error Handling**: Use centralized error handling patterns

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Check the [API Documentation](./docs/API_OVERVIEW.md)
- Review [Error Handling Guide](./docs/ERROR_HANDLING.md)
- Examine test files for usage examples
- Contact the development team