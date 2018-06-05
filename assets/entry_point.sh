#!/bin/bash

python3 ./main.py

export PATH=$PATH:node_modules/.bin

gulp clean
gulp build