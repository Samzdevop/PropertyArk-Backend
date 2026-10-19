# Use a lightweight Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and Prisma schema first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma Client
RUN npm ci --only=production
RUN npx prisma generate

# Copy the rest of your application code
COPY . .

# Build the TypeScript project (if applicable)
RUN npm run build

# Expose the application port
EXPOSE 3000

# Command to run migrations and start the app
# Note: 'prisma migrate deploy' is safe for production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]