
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
COPY prisma ./prisma/

RUN yarn install --frozen-lockfile

RUN yarn prisma generate

COPY . .

RUN yarn build


# Stage 2: Production dependencies
FROM node:22-alpine AS production-deps

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
COPY prisma ./prisma/

RUN yarn install --frozen-lockfile --production=true

RUN yarn prisma generate


# Stage 3: Runtime
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/prisma ./prisma
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["sh", "-c", "yarn prisma migrate deploy && node build/index.js"]