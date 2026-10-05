# Knights of Old room server. Build: docker build -t knights-server .   Run: docker run -p 8080:8080 knights-server
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:server && npm prune --omit=dev
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist-server/index.js"]
