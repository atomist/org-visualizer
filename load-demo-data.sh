#!/usr/bin/env bash

echo Spidering Atomist open source...
spider --o atomist --u

echo Spidering microservices demo
spider --o microservices-demo --u

echo Spidering CapitalOne Hygieia
spider --o hygieia --u

echo Spidering Spring boot demos...
spider --o spring-team --u