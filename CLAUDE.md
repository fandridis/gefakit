# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GefaKit is a fullstack framework for quickly prototyping new ideas. It consists of a backend API and a frontend web application, organized as a monorepo using PNPM workspaces.

### Architecture

- **Backend**: A Cloudflare Workers application built with Hono, Kysely, and Postgres
- **Frontend**: A React application built with Vite, TanStack Router, and TanStack Query
- **Database**: Postgres database via Neon (serverless PostgreSQL)

## Common Commands

### Development

```bash
# Run the web app in development mode
pnpm dev:web
# or
pnpm --filter gefakit-web dev

# Run the API in development mode
pnpm dev:api
# or
pnpm --filter gefakit-api dev

# Run both in parallel (requires two terminals)
pnpm dev:web
pnpm dev:api
```

### Database Operations

```bash
# Generate TypeScript types from database schema (development)
pnpm --filter gefakit-api db:types:development

# Run migrations (development)
pnpm --filter gefakit-api db:migrate:development

# Run migration rollback (development)
pnpm --filter gefakit-api db:migrate:down:development

# Seed the database
pnpm --filter gefakit-api db:seed:file

# Drop all tables (development)
pnpm --filter gefakit-api db:drop:development
```

### Testing

```bash
# Run all tests
pnpm --filter gefakit-api test

# Migration for test environment
pnpm --filter gefakit-api db:migrate:test
```

### Deployment

```bash
# Web deployment (development)
pnpm --filter gefakit-web build:development
pnpm --filter gefakit-web deploy:development

# Web deployment (production)
pnpm --filter gefakit-web build:production
pnpm --filter gefakit-web deploy:production

# API deployment (production)
pnpm --filter gefakit-api deploy:production:yes-i-am-sure
```

### Linting

```bash
# Lint the web app
pnpm --filter gefakit-web lint
```

## Code Structure

### Backend (apps/api)

- **src/create-app.ts**: Main application setup with middleware configuration
- **src/features/**: Feature modules containing routes, services, and repositories
  - Each feature is organized in its own directory with specific responsibilities
  - Typical feature contains routes, service, repository and error files
- **src/middleware/**: Middleware components for authentication, rate limiting, etc.
- **src/db/**: Database migrations, seeds, and type definitions
- **src/lib/**: Utility functions and shared libraries
- **src/types/**: TypeScript type definitions

### Frontend (apps/web)

- **src/main.tsx**: Application entry point with router and query client setup
- **src/features/**: Feature modules organized by domain
- **src/components/**: Reusable UI components
  - **ui/**: Core UI components built on Radix UI
  - **form/**: Form-related components
  - **layout/**: Layout components
- **src/routes/**: Route definitions using TanStack Router
- **src/lib/**: Utility functions and shared libraries
- **src/context/**: React context providers

## Database Setup

The application uses Neon Postgres with separate databases for development, staging, and production. Connection strings need to be set in the .dev.vars file:

```
DATABASE_URL and DATABASE_URL_POOLED for development
DATABASE_URL and DATABASE_URL_POOLED for staging
DATABASE_URL and DATABASE_URL_POOLED for production
```

## KV Namespace Setup

The application uses Cloudflare KV namespaces. You need to create separate namespaces for each environment and configure them in wrangler.jsonc.

## Environment-Specific Configuration

The project uses environment-specific configurations:
- `.dev.vars` for development environment variables
- Cloudflare Worker environments for deployment

When developing the API, the database URL and other environment variables are read from .dev.vars.