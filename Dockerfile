FROM atomist/sdm-base:0.3.0

# host ha.pool.sks-keyservers.net to obtain ip address
RUN apt-key adv --keyserver hkp://192.146.137.98 --recv-keys B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8

RUN echo "deb http://apt.postgresql.org/pub/repos/apt/ precise-pgdg main" > /etc/apt/sources.list.d/pgdg.list

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get install -y postgresql postgresql-client postgresql-contrib

COPY ./node_modules/@atomist/sdm-pack-aspect/ddl/create.ddl ./ddl/create.ddl

USER postgres

RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER org_viz WITH SUPERUSER PASSWORD 'atomist';" && \
    createdb -O org_viz org_viz && \
    psql -f /sdm/ddl/create.ddl org_viz

# Add VOLUMEs to allow backup of config, logs and databases
VOLUME  ["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]

USER root:root

COPY package.json package-lock.json ./

ENV NODE_ENV development
RUN npm ci \
    && npm cache clean --force

COPY . .

RUN npm install -g @atomist/cli

ENV NODE_ENV production
ENV ATOMIST_MODE local
ENV ATOMIST_POSTGRES start
