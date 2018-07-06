#!/bin/bash

python3 ./main.py

export PATH=$PATH:node_modules/.bin

# Clean former build path
gulp clean

# Wait up to MAX_TIMEOUT_SEC seconds to check if families.json is present
# Exit if not found
echo "waiting for families.json availability"
MAX_TIMEOUT_SEC=20
timeout ${MAX_TIMEOUT_SEC} bash -c "until ls /app/fam/families.json 2>/dev/null; do sleep 2;done"
if [[ $? -ne 0 ]]
then
    echo "File not found, stopping now"
    exit 1
else
    echo "File found. Setting up GUI content..."
fi


# Copy sources to build path
gulp prepare

# Modify sources to integrate viztools
gulp build

# Update API endpoints
gulp \
    --tomee=${TOMEE_ADDR} \
    --tomcat=${TOMCAT_ADDR} \
    --gunicorn=${GUNICORN_ADDR} \
    --opentsdb=${OPENTSDB_ADDR} \
set-api-endpoints