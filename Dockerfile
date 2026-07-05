# ---- Stage 1: install dependencies ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build the app ----
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3: minimal runtime image ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output contains server.js + only the node_modules it needs
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# pdf-parse loads @napi-rs/canvas and the pdfjs worker dynamically, which
# Next's file tracing misses — copy them in explicitly or PDF parsing breaks.
COPY --from=deps /app/node_modules/@napi-rs ./node_modules/@napi-rs
COPY --from=deps /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist

# SQLite DB + uploaded resumes live here — mount a volume at /app/data to persist
RUN mkdir -p /app/data/uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
