# Stage 1: Build the NestJS application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma schema and generated files
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built application files
COPY --from=builder /usr/src/app/dist ./dist

# Expose port and start app
EXPOSE 3000

CMD ["node", "dist/main"]
