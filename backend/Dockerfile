FROM node:22-alpine

RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

# --prod=false forces devDependencies (e.g. @nestjs/cli) to install even when
# NODE_ENV=production is injected at build time, so `nest build` is available.
RUN pnpm install --prod=false

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "run", "start:prod"]