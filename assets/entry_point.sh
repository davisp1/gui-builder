#!/bin/bash

python3 ./main.py

export PATH=$PATH:node_modules/.bin

# Clean former build path
gulp clean

# Copy sources to build path
gulp prepare

# Modify sources to integrate viztools
gulp build