FROM node:9.11.1-jessie

LABEL license="Apache License, Version 2.0"
LABEL copyright="CS Systèmes d'Information"
LABEL maintainer="contact@ikats.org"
LABEL version="0.9.1"

# Adding jessie backport for python3-git
RUN echo "deb http://ftp.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/backport.list

# Install dependencies
RUN apt-get update \
 && apt-get install -y \
    git \
    python3 \
    python3-git \
    python3-yaml \
 && rm -rf /var/lib/apt/lists/* \
 && npm install npm@latest -g

WORKDIR /app

# Creating app directories
RUN mkdir -p  /app/src /app/build /app/fetch-vt /app/local /app/fam

# Install node dependencies
ADD assets/package.json /app/
RUN npm install

# Adding other assets
ADD src /app/src
ADD assets/entry_point.sh /app/
ADD assets/gulpfile.js /app/
ADD assets/main.py /app/
ADD assets/repo-list.yml /app/

VOLUME /app/build
VOLUME /app/fetch-vt
VOLUME /app/src
VOLUME /app/local
VOLUME /app/fam

# Do git clone no matter the validity of the certificate
ENV GIT_SSL_NO_VERIFY true

# Starting component
CMD bash ./entry_point.sh
