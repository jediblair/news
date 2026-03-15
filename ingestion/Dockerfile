FROM node:20-alpine

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm install

# Source is bind-mounted at runtime (dev) or copied here (prod)
COPY . .

RUN npm run build

CMD ["node", "dist/index.js"]
