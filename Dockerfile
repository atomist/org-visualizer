FROM atomist/sdm-base:0.2.0

COPY package.json package-lock.json ./

ENV NODE_ENV development
RUN npm ci \
    && npm cache clean --force

COPY . .

RUN npm link

RUN spider --owner atomist

ENV ATOMIST_MODE local
