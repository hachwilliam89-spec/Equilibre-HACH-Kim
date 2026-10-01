FROM node:24-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
  && corepack prepare --activate \
  && pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --chown=node:node balance.mjs ./

USER node

ENTRYPOINT ["node", "balance.mjs"]
CMD ["--once"]
