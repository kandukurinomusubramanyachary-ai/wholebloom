FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV MEG_V2_DATA_DIR=/var/lib/bloom/meg-v2

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY meg-engine-v2/package.json ./meg-engine-v2/package.json
RUN npm install --omit=dev --prefix meg-engine-v2 --no-audit --no-fund

COPY server ./server
COPY meg-engine-v2 ./meg-engine-v2

RUN mkdir -p "$MEG_V2_DATA_DIR"
VOLUME ["/var/lib/bloom/meg-v2"]

EXPOSE 8080
CMD ["npm", "run", "server"]
