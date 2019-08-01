FROM profilehost.docker.ing.net/node-alpine-git

RUN npm install -g vscode

RUN no
# export http_proxy=172.27.205.161:3129
# export https_proxy=172.27.205.161:3129
# export no_proxy=127.0.0.1,192.168.99.100,localhost,.intranet,.ing.nl,.ing.net
