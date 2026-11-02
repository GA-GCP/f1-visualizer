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
# actually resolves. Dockerfile.ci pins the same nginx image and
# cloudbuild/frontend.yaml the same node image (_NODE_IMAGE); each must move
# with its counterpart, and PR checks fail when they disagree.
#
# The pins sit in the FROM lines themselves rather than in an `ARG X=...` above
# a `FROM ${X}`. Dependabot reads FROM lines as written and does not expand
# ARGs, so behind ARGs it found no base images at all and never proposed an
# update. Nothing passed those ARGs with --build-arg.

# ==========================================
# STAGE 1: Build the React Application
# ==========================================
FROM node:26.12.1-alpine3.24@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS builder

WORKDIR /app

# Accept the environment variable from Cloud Build
ARG ENV_MODE=dev

# 0. Install yarn itself
#
# The node:26 image ships neither yarn nor corepack, so every `yarn` below failed
# with `yarn: not found`. This is the release package.json names in
# packageManager, and the two must move together; cloudbuild/frontend.yaml
# installs the same one. --ignore-scripts skips yarn's only script, a preinstall
# that checks for a corepack this image does not have.
RUN npm install --global --ignore-scripts yarn@1.22.22

# 1. Install dependencies
#
# --ignore-scripts skips node-gyp, and with it the `canvas` native addon. canvas
# exists only for the visual-regression tests, has no musl prebuilt, and needs a
# C++ toolchain plus Cairo and Pango headers that this stage never installs —
# which cloudbuild/frontend.yaml documents and installs for its own test step.
# So the documented local image build was either failing here or spending
# minutes compiling Cairo bindings for an image that never runs a test.
# vite and tsc need no install scripts.
#
# shims/ comes along because package.json resolutions install packages from it
# (file:./shims/...), and the install fails without them.
COPY package.json yarn.lock ./
COPY shims ./shims
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
# -slim, because the full alpine variant adds njs, the image-filter, xslt and
# geoip modules, and curl — none of which nginx.conf loads — and with them the
# gd, tiff, libx11 and brotli libraries whose fixable HIGH and CRITICAL CVEs
# failed the image scan. Slim is the same nginx, uid 101 and port 8080 without
# them.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine-slim@sha256:a8cb0f33d51fa107c96fd2bd3a71aaf564ec131e9d2bdf8700944f0ed8b170d7

# 1. Copy the custom Nginx config (SPA Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy the built static assets from Stage 1 to the Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. Expose port 8080 (standard for unprivileged nginx)
EXPOSE 8080

# 4. Start Nginx
# The base is nginxinc/nginx-unprivileged, which runs as uid 101 and listens on
# 8080 for exactly that reason. Semgrep cannot resolve a base image's default
# USER; the unprivileged variant is the whole point of choosing it.
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["nginx", "-g", "daemon off;"]