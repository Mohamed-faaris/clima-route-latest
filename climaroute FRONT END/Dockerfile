# Frontend Build Stage
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ARG GEMINI_API_KEY
ARG REACT_APP_LOG_LEVEL
ENV VITE_API_URL=$VITE_API_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV REACT_APP_LOG_LEVEL=$REACT_APP_LOG_LEVEL

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build for production
RUN bun run build

# Production stage with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:80 || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
