#!/bin/bash
hugo --cleanDestinationDir
rsync -avz --delete -e "ssh -i /home/soth/.config/.ssh/id_ed" /home/soth/Documentos/blog/public/ root@216.238.99.112:/var/www/html/ 
