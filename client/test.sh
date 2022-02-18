#!/usr/bin/env bash

set -e;

for i in $(seq 100); do
	npm test || exit 1;
  sleep 1;
done
