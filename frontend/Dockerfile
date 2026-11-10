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

# 0. Install pnpm itself
#
# The node:26 image ships neither pnpm nor corepack. pnpm 12 is a native
# program, published on the npm registry as one package per platform, so this
# fetches the musl build for the CPU the image is built for and checks it
# against a sha512 pinned here. Nothing is fetched when pnpm first runs.
#
# The version is the one package.json names in packageManager, and the hashes
# are the integrity pnpm-lock.yaml records for @pnpm/exe.linux-*-musl at that
# version; cloudbuild/frontend.yaml pins the x64 one too. All of them move
# together, and the PR check fails when they disagree. TARGETARCH is set by
# BuildKit; `uname -m` covers a builder without it.
ARG TARGETARCH
ARG PNPM_VERSION=12.18.0
RUN set -eu; \
    case "${TARGETARCH:-$(uname -m)}" in \
      amd64|x86_64) pkg=linux-x64-musl; \
        sum=523fafcdf210eb69033f5d31dfac876485d5b39a2174db623d8c27e458422e53527073e8d0e008f928460ed2e87e2057284eee9aeef52668e6ecdf1af3355c0f ;; \
      arm64|aarch64) pkg=linux-arm64-musl; \
        sum=569f9320c3cfc9a7245425e439d10a1ff466027febd3b11c232ae065840aed5ae492ca993a27b41a7588c7ef3998fa9e14460246d5c8640149f4be1c7939dd0e ;; \
      *) echo "No pinned pnpm binary for ${TARGETARCH:-$(uname -m)}" >&2; exit 1 ;; \
    esac; \
    wget -qO /tmp/pnpm.tgz "https://registry.npmjs.org/@pnpm/exe.${pkg}/-/exe.${pkg}-${PNPM_VERSION}.tgz"; \
    echo "${sum}  /tmp/pnpm.tgz" | sha512sum -c -; \
    tar -xzf /tmp/pnpm.tgz -C /tmp package/pnpm; \
    install -m 0755 /tmp/package/pnpm /usr/local/bin/pnpm; \
    rm -rf /tmp/pnpm.tgz /tmp/package; \
    pnpm --version

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
# shims/ comes along because the overrides in pnpm-workspace.yaml install a
# package from it (file:./shims/...), and the install fails without it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shims ./shims
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. Copy only what the build reads, rather than `COPY . .`
#
# `COPY . .` pulled in the host's dist/, the test suites and the image snapshots,
# and busted this layer's cache on any file change anywhere in frontend/.
#
# e2e/ and the vitest.*.config.ts files are here not because the image needs
# them but because `pnpm build` runs `tsc -b`, which builds every referenced
# project — tsconfig.e2e.json among them. Omitting them turns the build into a
# type error about missing inputs.
COPY index.html tsconfig*.json vite.config.ts vitest.e2e.config.ts vitest.screenshots.config.ts ./
COPY .env.* ./
COPY public ./public
COPY src ./src
COPY e2e ./e2e
RUN pnpm build --mode ${ENV_MODE}

# ==========================================
# STAGE 2: Serve with NGINX (Unprivileged)
# ==========================================
# -slim, because the full alpine variant adds njs, the image-filter, xslt and
# geoip modules, and curl — none of which nginx.conf loads — and with them the
# gd, tiff, libx11 and brotli libraries whose fixable HIGH and CRITICAL CVEs
# failed the image scan. Slim is the same nginx, uid 101 and port 8080 without
# them.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine-slim@sha256:a8cb0f33d51fa107c96fd2bd3a71aaf564ec131e9d2bdf8700944f0ed8b170d7

# Alpine's own packages, brought up to date over the pinned base. nginx-unprivileged
# is rebuilt on its own schedule, not Alpine's: this digest is Alpine 3.24.2, and
# the musl (CVE-2026-107891) and zlib (CVE-2026-85091) fixes Alpine has since
# shipped failed the image scan with no newer digest to move to. Once the pinned
# base carries current packages this is a no-op. Only Alpine's main and community
# repositories are configured in the base, so nginx itself is not touched.
# Dockerfile.ci carries the same lines; the two must stay identical.
USER root
RUN apk upgrade --no-cache
USER 101

# 1. Copy the custom Nginx config (SPA Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy the built static assets from Stage 1 to the Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. Expose port 8080 (standard for unprivileged nginx)
EXPOSE 8080

# 4. Start Nginx
# The base is nginxinc/nginx-unprivileged, which runs as uid 101 and listens on
# 8080 for exactly that reason; the `USER 101` above hands the image back to
# that user after the package upgrade.
CMD ["nginx", "-g", "daemon off;"]