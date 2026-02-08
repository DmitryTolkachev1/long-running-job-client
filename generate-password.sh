#!/bin/bash

if [ $# -ne 2 ]; then
    echo "Usage $0 <username> <password>"
    echo "Example: $0 admin pasword"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

htpassword -nb "$USERNAME" "$PASSWORD"