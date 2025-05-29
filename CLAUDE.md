# CLAUDE.md

This is a Next.js 15 frontend with Python backend application using TypeScript, Tailwind CSS v4, and shadcn/ui.

## Commands

### Frontend (Next.js)
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production bundle
- `npm run lint` - Run ESLint and type check
- `npx shadcn@latest add [component]` - Add shadcn/ui components

### Backend (Python)
- `python -m uvicorn main:app --reload` - Start FastAPI server
- `black . && isort .` - Format Python code
- `pylint **/*.py` - Lint Python code
- `radon cc . --min B` - Check code complexity (max CC 10)
- `pytest` - Run Python tests

## Architecture

**Frontend:**
- `src/app/` - Next.js App Router pages and layouts
- `src/components/` - React components (shadcn/ui + custom)
- `src/lib/` - Utilities and API client
- `@/*` maps to `./src/*`

**Backend:**
- `app/` - FastAPI application
- `app/models/` - Pydantic models and database schemas
- `app/routers/` - API route handlers
- `app/services/` - Business logic

## Code Standards

### TypeScript/React
- Use TypeScript strict mode
- Functional components with hooks
- Use Tailwind CSS utilities, avoid custom CSS
- **IMPORTANT**: Always run `npm run lint` before committing

### Python
- **IMPORTANT**: Use `black` (88 char line length) and `isort` for formatting
- **IMPORTANT**: Maintain pylint score above 8.0/10
- **IMPORTANT**: Keep cyclomatic complexity below 10 (radon CC rating A-B)
- Use FastAPI with Pydantic models
- Keep functions under 15 lines
- Type hints required for all functions

## Project Structure
```
/
├── src/           # Next.js frontend
├── app/           # Python FastAPI backend
├── package.json   # Frontend dependencies
└── requirements.txt # Python dependencies
```

## Git Workflow
- Feature branches from `main`
- Run both `npm run lint` and `pylint` before commits
- Include tests for new features