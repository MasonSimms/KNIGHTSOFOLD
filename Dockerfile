# Knights of Old: the room server and the game page in one (fly deploy builds this). Local: docker build -t knights . ; docker run -p 8080:8080 knights
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server && npm prune --omit=dev
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist-server/index.js"]
