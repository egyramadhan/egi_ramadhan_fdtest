# Egi Ramadhan FD Test

Aplikasi full-stack untuk manajemen buku dengan sistem autentikasi menggunakan Next.js (frontend) dan Express.js (backend).

## 🚀 Fitur

- **Autentikasi**: Login, register, verifikasi email, reset password
- **Manajemen Buku**: CRUD operations untuk buku dengan upload gambar
- **Dashboard**: Interface yang user-friendly untuk mengelola buku
- **API Documentation**: Swagger UI untuk dokumentasi API
- **Rate Limiting**: Perlindungan terhadap spam dan abuse
- **File Upload**: Upload thumbnail buku dengan validasi
- **Responsive Design**: UI yang responsif menggunakan Tailwind CSS

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework dengan App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **React Hot Toast** - Notifications
- **Headless UI** - Accessible UI components

### Backend
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Prisma** - ORM
- **Redis** - Caching dan session storage
- **JWT** - Authentication
- **Multer** - File upload
- **Zod** - Schema validation
- **Swagger** - API documentation

## 📋 Prerequisites

Pastikan Anda telah menginstall:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** dan **Docker Compose** (untuk database dan services)
- **Git**

## 🚀 Instalasi dan Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd egi_ramadhan_fdtest
```

### 2. Install Dependencies

```bash
# Install semua dependencies untuk workspace
npm run install:all
```

### 3. Setup Environment Variables

#### Backend Environment
Salin file `.env.example` ke `.env.local` di folder `apps/backend`:

```bash
cp apps/backend/.env.example apps/backend/.env.local
```

Edit `apps/backend/.env.local` sesuai kebutuhan:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=egi_ramadhan_fdtest
DB_USER=postgres
DB_PASSWORD=postgres

# Prisma Database URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/egi_ramadhan_fdtest

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (MailHog untuk development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@egi-ramadhan-fdtest.com

# Application Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Environment
Buat file `.env.local` di folder `apps/frontend`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# App Configuration
NEXT_PUBLIC_APP_NAME=Egi Ramadhan FD Test
NEXT_PUBLIC_APP_DESCRIPTION=A full-stack application for book management with authentication

# Development Configuration
NODE_ENV=development
```

### 4. Setup Database dan Services

#### Menggunakan Docker Compose (Recommended)

```bash
# Start PostgreSQL, Redis, dan MailHog
docker-compose up -d

# Verify services are running
docker-compose ps
```

#### Manual Setup (Alternative)
Jika tidak menggunakan Docker, install dan setup:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MailHog (port 1025 untuk SMTP, 8025 untuk web UI)

### 5. Setup Database Schema

```bash
# Generate Prisma client
npm run db:generate --workspace=apps/backend

# Push schema to database
npm run db:push --workspace=apps/backend

# Optional: Seed database dengan data sample
npm run db:seed --workspace=apps/backend
```

### 6. Jalankan Aplikasi

#### Development Mode

```bash
# Jalankan frontend dan backend secara bersamaan
npm run dev

# Atau jalankan secara terpisah:
# Frontend (port 3000)
npm run dev:frontend

# Backend (port 5000)
npm run dev:backend
```

#### Production Mode

```bash
# Build aplikasi
npm run build

# Start aplikasi
npm start
```

## 🌐 Akses Aplikasi

Setelah aplikasi berjalan, Anda dapat mengakses:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **API Documentation**: http://localhost:5000/api-docs
- **MailHog Web UI**: http://localhost:8025 (untuk melihat email development)
- **Prisma Studio**: `npm run db:studio --workspace=apps/backend`

## 📁 Struktur Project

```
egi_ramadhan_fdtest/
├── apps/
│   ├── frontend/          # Next.js application
│   │   ├── src/
│   │   │   ├── app/       # App Router pages
│   │   │   ├── components/ # React components
│   │   │   ├── lib/       # Utilities dan helpers
│   │   │   └── types/     # TypeScript types
│   │   ├── public/        # Static assets
│   │   └── package.json
│   └── backend/           # Express.js API
│       ├── src/
│       │   ├── routes/    # API routes
│       │   ├── middleware/ # Express middleware
│       │   ├── lib/       # Utilities dan helpers
│       │   ├── schemas/   # Zod validation schemas
│       │   └── server.js  # Entry point
│       ├── prisma/        # Database schema dan migrations
│       ├── uploads/       # File uploads directory
│       └── package.json
├── docker-compose.yml     # Docker services
├── package.json          # Root workspace configuration
└── README.md
```

## 🔧 Scripts yang Tersedia

### Root Level
```bash
npm run dev              # Start development mode (frontend + backend)
npm run build            # Build semua aplikasi
npm start               # Start production mode
npm run install:all     # Install dependencies untuk semua workspace
npm run dev:frontend    # Start frontend saja
npm run dev:backend     # Start backend saja
```

### Backend Specific
```bash
npm run dev --workspace=apps/backend              # Development mode
npm run start --workspace=apps/backend            # Production mode
npm run db:generate --workspace=apps/backend      # Generate Prisma client
npm run db:push --workspace=apps/backend          # Push schema ke database
npm run db:migrate --workspace=apps/backend       # Run migrations
npm run db:seed --workspace=apps/backend          # Seed database
npm run db:studio --workspace=apps/backend        # Open Prisma Studio
```

### Frontend Specific
```bash
npm run dev --workspace=apps/frontend             # Development mode
npm run build --workspace=apps/frontend           # Build untuk production
npm run start --workspace=apps/frontend           # Start production build
npm run lint --workspace=apps/frontend            # Run ESLint
```

## 🧪 Testing

```bash
# Run tests untuk semua workspace
npm test

# Run tests untuk backend saja
npm run test --workspace=apps/backend

# Run tests untuk frontend saja
npm run test --workspace=apps/frontend
```

## 📝 API Documentation

API documentation tersedia melalui Swagger UI di:
http://localhost:5000/api-docs

### Main Endpoints:

#### Authentication
- `POST /api/auth/register` - Register user baru
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

#### Books
- `GET /api/books` - Get semua buku
- `GET /api/books/:id` - Get buku berdasarkan ID
- `POST /api/books` - Create buku baru (dengan upload gambar)
- `PUT /api/books/:id` - Update buku
- `DELETE /api/books/:id` - Delete buku

#### User
- `GET /api/user/profile` - Get profile user
- `PUT /api/user/profile` - Update profile user

## 🔒 Authentication

Aplikasi menggunakan JWT (JSON Web Tokens) untuk authentication:

- **Access Token**: Berlaku 15 menit
- **Refresh Token**: Berlaku 7 hari
- **Automatic Refresh**: Frontend secara otomatis refresh token ketika diperlukan

## 📁 File Upload

- **Directory**: `apps/backend/uploads/thumbnails/`
- **Max Size**: 5MB
- **Allowed Types**: JPG, JPEG, PNG, GIF
- **URL Format**: `/uploads/thumbnails/filename.ext`

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check database logs
docker-compose logs postgres
```

### Redis Connection Issues
```bash
# Check if Redis is running
docker-compose ps redis

# Restart Redis
docker-compose restart redis
```

### Port Already in Use
```bash
# Check what's using port 3000 or 5000
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Kill process if needed
taskkill /PID <PID> /F
```

### Clear Node Modules dan Reinstall
```bash
# Remove node_modules
rm -rf node_modules apps/*/node_modules

# Clear npm cache
npm cache clean --force

# Reinstall
npm run install:all
```

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

Project ini menggunakan MIT License. Lihat file `LICENSE` untuk detail.

## 👨‍💻 Author

**Egi Ramadhan**

---

**Happy Coding! 🚀**