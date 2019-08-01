#!/bin/sh
set -x

repo="/clone/ProfileHost"
app="/app/src/pslLint/cli"
json="/tmp/psl-lint.json"
output="/app/output.txt"

cd ${app}
npm link

cd ${repo}
git checkout -f develop
cp psl-lint.json ${json}
tags="v19.11.0 develop";
for tag in $tags; do
	git checkout -f develop
	git checkout -f ${tag};
	cp ${json} .
	echo "############ ${tag} ############"
	time psl-lint --output=/dev/null 'dataqwik/procedure;dataqwik/batch;dataqwik/trigger;test/psl;dataqwik/table'
done;
