#!/bin/bash

# Signal Notes - Complete Setup Script
# This script sets up the entire application structure

echo "🚀 Setting up Signal Notes..."

# Create all API route directories
mkdir -p app/api/auth/\[...nextauth\]
mkdir -p app/api/notes/\[id\]/extract
mkdir -p app/api/actions/\[id\]
mkdir -p app/api/actions/refresh  
mkdir -p app/api/settings
mkdir -p app/api/macro-goals
mkdir -p app/api/upload

# Create component directories
mkdir -p components/editor
mkdir -p components/actions
mkdir -p components/notes
mkdir -p app/\(auth\)/login
mkdir -p app/\(app\)/notes/\[id\]
mkdir -p app/\(app\)/settings

echo "✅ Directory structure created"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed"

# Setup instructions
echo ""
echo "===================================="
echo "SETUP INSTRUCTIONS"
echo "===================================="
echo ""
echo "1. Copy .env.example to .env and fill in your values:"
echo "   - DATABASE_URL (Railway Postgres)"
echo "   - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
echo "   - OPENAI_API_KEY"
echo "   - AWS credentials and S3 bucket"
echo ""
echo "2. Run: npx prisma generate"
echo "3. Run: npx prisma db push"
echo "4. Create first user (see script below)"
echo "5. Run: npm run dev"
echo ""
echo "===================================="
echo ""

# Create user creation script
cat > scripts/create-user.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: npx tsx scripts/create-user.ts <email> <password>');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  console.log('User created:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
EOF

mkdir -p scripts

echo "📝 Created user creation script at scripts/create-user.ts"
echo ""
echo "To create a user, run:"
echo "  npx tsx scripts/create-user.ts your@email.com yourpassword"
echo ""
