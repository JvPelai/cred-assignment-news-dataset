
# Dockerfile
FROM node:22.19-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install OpenSSL (required by Prisma)
RUN apk add --no-cache openssl

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]