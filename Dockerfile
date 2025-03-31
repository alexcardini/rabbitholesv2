# Use Node.js LTS version
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install -w frontend -w backend && npm install

# Copy source code
COPY . .

# Build frontend and backend
RUN npm run build

# Production stage
FROM node:18-alpine as production

WORKDIR /app

# Copy package files for production
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install production dependencies only
RUN npm install -w frontend -w backend --production && npm install --production

# Copy built assets from builder stage
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/build ./frontend/build

# Install ts-node and typescript for production (since the start script uses ts-node)
RUN npm install -g ts-node typescript

# Expose port
EXPOSE 3000

# Add required environment variables with defaults
ENV PORT=3000
ENV NODE_ENV=production

# Start the server with debugging
CMD ["sh", "-c", "cd backend && node dist/server.js"] 