# Image of the scheduled worker, run as a Nebius Serverless AI Job (CPU only).
# It applies pending migrations, writes every newsletter whose issue is due, and exits.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY lib ./lib
COPY scripts ./scripts
COPY db ./db
ENV NFO_TRIGGER=nebius-job
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npx tsx scripts/worker.ts"]
