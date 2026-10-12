#!/bin/sh
set -eu

OUT="$(dirname "$0")/../../src/lib/motion/sfx"
mkdir -p "$OUT"

sound() {
  name=$1; seconds=$2; expr=$3; filters=$4
  ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='$expr':s=44100:d=$seconds" \
    -af "$filters,alimiter=limit=0.9" \
    -metadata title="$name" -metadata copyright="CC0-1.0" -ac 1 -b:a 64k "$OUT/$name.mp3"
}

sound click 0.08 "(0.7*sin(2*PI*1800*t)*exp(-t*260)+0.5*(random(0)*2-1)*exp(-t*420))" "highpass=f=500"
sound key 0.06 "(0.35*sin(2*PI*3200*t)*exp(-t*480)+0.45*(random(1)*2-1)*exp(-t*650))" "highpass=f=900"
sound whoosh 0.6 "(random(2)*2-1)*pow(sin(PI*t/0.6),2)*0.8" "lowpass=f=2200,highpass=f=180"
