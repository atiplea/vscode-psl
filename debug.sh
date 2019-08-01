#!/bin/sh
set -x

repo="/clone/ProfileHost"
app="/app/src/pslLint/cli"
main="${app}/lib/pslLint/cli/cli.js"

cd ${repo}
git checkout -f develop

node --inspect-brk=0.0.0.0:5858 ${main} --output=/dev/null "dataqwik/procedure;dataqwik/batch;dataqwik/trigger;test/psl;dataqwik/table"
