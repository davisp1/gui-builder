FROM node:9.11.1-jessie

# Adding backport for python3-git
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

# Adding assets
RUN mkdir -p  /app/src /app/build /app/fetch-vt /app/local
ADD src /app/src
ADD assets/main.py /app/
ADD assets/repo-list.yml /app/
ADD assets/entry_point.sh /app/
ADD assets/gulpfile.js /app/
ADD assets/package.json /app/

# Install node dependencies
RUN npm install

VOLUME /app/build
VOLUME /app/fetch-vt
VOLUME /app/src
VOLUME /app/local

# Starting component
CMD bash ./entry_point.sh