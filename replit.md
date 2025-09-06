# DJ Library

## Overview

DJ Library is a full-stack web application that allows users to manage their music collection by connecting to Discogs (a music database and marketplace). Users can authenticate with Discogs, import their collection, and browse/search through their tracks with advanced filtering and sorting capabilities. The application is built with React on the frontend, Express.js on the backend, and uses PostgreSQL with Drizzle ORM for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens and dark theme
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite with React plugin and runtime error overlay for development

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: Neon serverless PostgreSQL database
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Authentication**: OAuth 1.0a flow with Discogs API
- **Development**: Hot module replacement with Vite middleware integration

### Database Schema
The application uses three main entities:
- **Users**: Store user credentials and Discogs OAuth tokens
- **Releases**: Album/record information imported from Discogs
- **Tracks**: Individual song data with relationships to releases and users

Key relationships:
- Users have many releases and tracks
- Releases belong to users and have many tracks
- Tracks belong to both users and releases

### API Structure
- **REST endpoints**: Standard HTTP methods for CRUD operations
- **OAuth flow**: `/api/auth/discogs` for authentication initiation and callback handling
- **Import functionality**: Batch import of user's Discogs collection
- **Search and filtering**: Advanced query parameters for track searching with pagination
- **Statistics**: Aggregated data about user's collection

### Authentication and Authorization
- **OAuth Integration**: Discogs OAuth 1.0a for secure API access
- **Token Storage**: Encrypted storage of OAuth access tokens in database
- **Session Management**: Server-side sessions with PostgreSQL backing store
- **Security**: CSRF protection and secure cookie handling

## External Dependencies

### Third-Party Services
- **Discogs API**: Music database integration for collection import and metadata
- **Neon Database**: Serverless PostgreSQL hosting platform

### Frontend Dependencies
- **UI Components**: Extensive Radix UI primitive library for accessible components
- **Form Handling**: React Hook Form with Zod validation resolvers
- **Date Utilities**: date-fns for date manipulation and formatting
- **Icons**: Lucide React for consistent iconography

### Backend Dependencies
- **Database**: @neondatabase/serverless for connection pooling and serverless compatibility
- **WebSocket Support**: ws library for Neon database WebSocket connections
- **Development Tools**: tsx for TypeScript execution and esbuild for production builds

### Development Tools
- **Bundling**: Vite with React and Replit-specific plugins
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **TypeScript**: Strict type checking with path mapping for clean imports
- **Code Quality**: ESLint and Prettier configurations (implied by project structure)