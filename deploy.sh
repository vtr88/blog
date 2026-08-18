#!/bin/sh
set -eu

cd -- "$(dirname -- "$0")"

hugo --cleanDestinationDir
rsync -avz --delete \
  -e 'ssh -F /home/soth/.ssh/config -i /home/soth/.config/.ssh/id_ed' \
  public/ root@216.238.99.112:/var/www/html/
