#!/bin/bash

python3 ./main.py

export PATH=$PATH:node_modules/.bin

# Clean former build path
gulp clean

# Copy sources to build path
gulp prepare

# Modify sources to integrate viztools
gulp build

gulp \
    --tomee=${TOMEE_ADDR} \
    --tomcat=${TOMCAT_ADDR} \
    --gunicorn=${GUNICORN_ADDR} \
    --opentsdb=${OPENTSDB_ADDR} \
set-api-endpoints