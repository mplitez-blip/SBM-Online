FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Include development tools required by the migration and build steps.
RUN npm ci --include=dev --include=optional

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]


