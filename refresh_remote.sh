git pub
ssh 972.ovh "cd 0x972.info/tools/meteo.ai && git pull"
ssh 972.ovh systemctl start --user meteo-stats --now --wait
