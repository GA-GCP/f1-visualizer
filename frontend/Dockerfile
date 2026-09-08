# ==========================================
# Base images, pinned by digest.
# ==========================================
# `node:26-alpine` tracked every 26.x patch and every Alpine bump, and
# `nginx-unprivileged:alpine` carried no nginx version at all — so two builds of
# the same commit could produce a different nginx binary and, because canvas is
# compiled from source, a different native addon against whatever musl and cairo
# Alpine shipped that day. A digest makes the base image part of the commit.
#
# The tag is kept alongside the digest for readability; the digest is what
# actually resolves. Dockerfile.ci pins the same NGINX_IMAGE and the two must
# move together.
ARG NODE_IMAGE=node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.31.5-alpine@sha256:2ddec616f1cb58bcac057aa388f28cb81e35137641ef4226d321714499329bd1

# ==========================================
# STAGE 1: Build the React Application
# ==========================================
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Accept the environment variable from Cloud Build
ARG ENV_MODE=dev

# 1. Install dependencies
#
# --ignore-scripts skips node-gyp, and with it the `canvas` native addon. canvas
# exists only for the visual-regression tests, has no musl prebuilt, and needs a
# C++ toolchain plus Cairo and Pango headers that this stage never installs —
# which cloudbuild/frontend.yaml documents and installs for its own test step.
# So the documented local image build was either failing here or spending
# minutes compiling Cairo bindings for an image that never runs a test.
# vite and tsc need no install scripts.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts

# 2. Copy only what the build reads, rather than `COPY . .`
#
# `COPY . .` pulled in the host's dist/, the test suites and the image snapshots,
# and busted this layer's cache on any file change anywhere in frontend/.
#
# e2e/ and playwright.config.ts are here not because the image needs them but
# because `yarn build` runs `tsc -b`, which builds every referenced project —
# tsconfig.e2e.json among them. Omitting them turns the build into a type error
# about missing inputs.
COPY index.html tsconfig*.json vite.config.ts playwright.config.ts ./
COPY .env.* ./
COPY public ./public
COPY src ./src
COPY e2e ./e2e
RUN yarn build --mode ${ENV_MODE}

# ==========================================
# STAGE 2: Serve with NGINX (Unprivileged)
# ==========================================
FROM ${NGINX_IMAGE}

# 1. Copy the custom Nginx config (SPA Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy the built static assets from Stage 1 to the Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. Expose port 8080 (standard for unprivileged nginx)
EXPOSE 8080

# 4. Start Nginx
CMD ["nginx", "-g", "daemon off;"]