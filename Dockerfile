# Base image
FROM node:20-alpine AS base
WORKDIR /app

# Build stage
FROM base AS builder
COPY package*.json ./
COPY prisma ./prisma/
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)
COPY . .
RUN npx prisma generate
RUN npm run build

# Production runtime stage
FROM base AS runner
LABEL author="ptn3001 <trungnguyenphan3001@gmail.com>"

# Install LibreOffice and fonts for certificate/PDF generation
RUN apk add --no-cache libreoffice fontconfig ttf-dejavu tzdata

ENV NODE_ENV=production
ENV PORT=3001

# Set timezone to Vietnam
ENV TZ=Asia/Ho_Chi_Minh
RUN ln -sf /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# Create non-root runtime user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy build output and runtime dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/font ./font
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.js ./next.config.js

# Install custom fonts
RUN mkdir -p /usr/share/fonts/custom && \
    cp -r /app/font/* /usr/share/fonts/custom/ && \
    fc-cache -f -v

# Prepare writable runtime directories
RUN mkdir -p /app/temp /app/certificates && \
    chown -R nextjs:nodejs /app/temp /app/certificates /app

USER nextjs

EXPOSE 3001

# Run database migrations then start app
CMD ["sh", "-c", "npx prisma migrate deploy; npm run start -- -p 3001"]
