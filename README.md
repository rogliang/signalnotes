# Signal Notes - Session 1: Foundation

## What's Built

✅ Database schema (Prisma + PostgreSQL)  
✅ Authentication system (email/password, single user)  
✅ Settings page (CEO identity + AI context)  
✅ Project structure with Next.js 14 + TypeScript  
✅ Tailwind CSS styling foundation  

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Railway PostgreSQL

1. Go to [Railway](https://railway.app)
2. Create new project
3. Add PostgreSQL database
4. Copy the `DATABASE_URL` from Railway

### 3. Configure Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
OPENAI_API_KEY="sk-..." # Not needed yet for Session 1
AWS_ACCESS_KEY_ID="your-key" # Not needed yet
AWS_SECRET_ACCESS_KEY="your-secret" # Not needed yet
AWS_REGION="us-east-1"
AWS_S3_BUCKET="signal-notes-uploads"
AUTH_SECRET="run: openssl rand -base64 32"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Initialize Database

```bash
npx prisma db push
```

This creates all tables in your Railway PostgreSQL database.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. First-Time Setup

1. You'll be redirected to `/login`
2. Click "Need an account? Sign up"
3. Create your account (first user only)
4. You'll be redirected to Settings
5. Configure:
   - CEO First Name (e.g., "Eric")
   - Aliases (e.g., "E, Boss")
   - Context Prompt with your role, goals, priorities

## What You Can Do Now

- ✅ Sign up / Sign in
- ✅ Configure CEO identity
- ✅ Set AI context (your role, goals, company vision)
- ✅ View and edit settings

## Database Schema Overview

**User** - Authentication (email/password)  
**Settings** - CEO name, aliases, AI context  
**Note** - Future: notes with rich text  
**Action** - Future: extracted tasks  
**Topic** - Future: normalized entities  
**MacroGoal** - Future: inferred strategic goals  
**Evidence** - Future: links actions to note excerpts  

## Next Session Preview

**Session 2** will build:
- TipTap rich text editor
- Note CRUD (create, read, update, delete)
- S3 image uploads
- Note list with search
- Auto-save functionality

## Troubleshooting

**Database connection fails:**
- Check `DATABASE_URL` in `.env` is correct
- Ensure Railway PostgreSQL is running

**Login doesn't work:**
- Clear cookies and try signup again
- Check browser console for errors

**Need to reset:**
```bash
npx prisma db push --force-reset
```

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npx prisma studio    # Open database GUI
npx prisma db push   # Sync schema to database
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Railway) + Prisma ORM
- **Styling:** Tailwind CSS
- **Auth:** bcrypt + HTTP-only cookies
- **Future:** TipTap (editor), OpenAI (extraction), AWS S3 (uploads)

---

**Status:** Session 1 Complete ✅  
**Next:** Session 2 - Notes System
