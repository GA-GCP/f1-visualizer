# ==========================================
# STAGE 1: Build the React Application
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# 1. Install dependencies (cached if package.json/yarn.lock hasn't changed)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# 2. Copy source and build
COPY . .
RUN yarn build

# ==========================================
# STAGE 2: Serve with NGINX (Unprivileged)
# ==========================================
FROM nginxinc/nginx-unprivileged:alpine

# 1. Copy the custom Nginx config (SPA Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy the built static assets from Stage 1 to the Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. Expose port 8080 (standard for unprivileged nginx)
EXPOSE 8080

# 4. Start Nginx
CMD ["nginx", "-g", "daemon off;"]