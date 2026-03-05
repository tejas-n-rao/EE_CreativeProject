FROM node:20-alpine

WORKDIR /workspace

COPY package.json ./package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm install

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

WORKDIR /workspace/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
