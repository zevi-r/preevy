FROM node:18-alpine as base
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn --mount=type=cache,id=livecycle/preview-proxy/npm-cache,target=/usr/local/share/.cache/yarn/v6
COPY . /app
EXPOSE 3000 2222

FROM base as test
CMD ["yarn", "test"]

FROM base as development
CMD [ "yarn", "dev" ]

FROM base as build
RUN yarn build

FROM build as production
LABEL org.opencontainers.image.source=https://github.com/livecycle/preview
LABEL org.opencontainers.image.description="Preview Tunnel Server"
CMD [ "yarn", "start" ]
