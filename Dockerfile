# syntax = docker/dockerfile:1.23

ARG NODE_VERSION=22.22.2-bookworm

# build assets & compile TypeScript

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS native-builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

WORKDIR /misskey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["patches", "./patches"]
COPY --link ["packages/backend/package.json", "./packages/backend/"]
COPY --link ["packages/frontend-shared/package.json", "./packages/frontend-shared/"]
COPY --link ["packages/frontend/package.json", "./packages/frontend/"]
COPY --link ["packages/frontend-embed/package.json", "./packages/frontend-embed/"]
COPY --link ["packages/frontend-builder/package.json", "./packages/frontend-builder/"]
COPY --link ["packages/i18n/package.json", "./packages/i18n/"]
COPY --link ["packages/icons-subsetter/package.json", "./packages/icons-subsetter/"]
COPY --link ["packages/sw/package.json", "./packages/sw/"]
COPY --link ["packages/misskey-js/package.json", "./packages/misskey-js/"]
COPY --link ["packages/misskey-reversi/package.json", "./packages/misskey-reversi/"]
COPY --link ["packages/misskey-bubble-game/package.json", "./packages/misskey-bubble-game/"]

ARG NODE_ENV=production

RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --frozen-lockfile --aggregate-output

COPY --link . ./

RUN git submodule update --init
RUN pnpm build
RUN rm -rf .git/

# build native dependencies for target platform

FROM --platform=$TARGETPLATFORM node:${NODE_VERSION} AS target-builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

WORKDIR /misskey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["patches", "./patches"]
COPY --link ["packages/backend/package.json", "./packages/backend/"]
COPY --link ["packages/misskey-js/package.json", "./packages/misskey-js/"]
COPY --link ["packages/misskey-reversi/package.json", "./packages/misskey-reversi/"]
COPY --link ["packages/misskey-bubble-game/package.json", "./packages/misskey-bubble-game/"]

ARG NODE_ENV=production

RUN node -e "console.log(JSON.parse(require('node:fs').readFileSync('./package.json')).packageManager)" | xargs npm install -g

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm i --frozen-lockfile --aggregate-output

# static ffmpeg binary (no shared library dependencies needed)
FROM mwader/static-ffmpeg:latest AS ffmpeg

# extract libjemalloc.so.2 to a fixed arch-independent path
# (distroless has no shell so we cannot create symlinks in the runner stage)
FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-slim AS jemalloc-provider
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends libjemalloc2 \
	&& cp "$(find /usr/lib -name 'libjemalloc.so.2' | head -1)" /libjemalloc.so.2

# extract tini binary
FROM --platform=$TARGETPLATFORM node:${NODE_VERSION}-slim AS tini-provider
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	rm -f /etc/apt/apt.conf.d/docker-clean \
	; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends tini

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

COPY --from=tini-provider     /usr/bin/tini       /tini
COPY --from=ffmpeg            /ffmpeg             /usr/local/bin/ffmpeg
COPY --from=ffmpeg            /ffprobe            /usr/local/bin/ffprobe
COPY --from=jemalloc-provider /libjemalloc.so.2   /usr/lib/libjemalloc.so.2

WORKDIR /misskey

COPY --chown=65532:65532 --from=target-builder /misskey/node_modules                              ./node_modules
COPY --chown=65532:65532 --from=target-builder /misskey/packages/backend/node_modules             ./packages/backend/node_modules
COPY --chown=65532:65532 --from=target-builder /misskey/packages/misskey-js/node_modules          ./packages/misskey-js/node_modules
COPY --chown=65532:65532 --from=target-builder /misskey/packages/misskey-reversi/node_modules     ./packages/misskey-reversi/node_modules
COPY --chown=65532:65532 --from=target-builder /misskey/packages/misskey-bubble-game/node_modules ./packages/misskey-bubble-game/node_modules
COPY --chown=65532:65532 --from=native-builder /misskey/built                                     ./built
COPY --chown=65532:65532 --from=native-builder /misskey/packages/misskey-js/built                 ./packages/misskey-js/built
COPY --chown=65532:65532 --from=native-builder /misskey/packages/misskey-reversi/built            ./packages/misskey-reversi/built
COPY --chown=65532:65532 --from=native-builder /misskey/packages/misskey-bubble-game/built        ./packages/misskey-bubble-game/built
COPY --chown=65532:65532 --from=native-builder /misskey/packages/backend/built                    ./packages/backend/built
COPY --chown=65532:65532 --from=native-builder /misskey/packages/i18n/built                       ./packages/i18n/built
COPY --chown=65532:65532 ["packages/backend/ormconfig.js",              "./packages/backend/"]
COPY --chown=65532:65532 ["packages/backend/migration",                 "./packages/backend/migration"]
COPY --chown=65532:65532 ["packages/backend/assets",                    "./packages/backend/assets"]
COPY --chown=65532:65532 ["packages/backend/scripts/compile_config.js", "./packages/backend/scripts/"]
COPY --chown=65532:65532 ["scripts/docker-start.js",                    "./scripts/"]
COPY --chown=65532:65532 ["healthcheck.js",                             "./"]

ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2
ENV NODE_ENV=production
HEALTHCHECK --interval=5s --retries=20 CMD ["/nodejs/bin/node", "/misskey/healthcheck.js"]
ENTRYPOINT ["/tini", "--"]
CMD ["/nodejs/bin/node", "/misskey/scripts/docker-start.js"]
