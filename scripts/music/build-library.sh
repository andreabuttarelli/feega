#!/bin/sh
set -eu

OUT="$(dirname "$0")/../../src/lib/motion/music"
LENGTH=32
mkdir -p "$OUT"

track() {
  name=$1; bpm=$2; root=$3; drive=$4
  b="(60/$bpm)"
  k="mod(floor(t/(4*$b)),4)"
  st="if(eq($k,0),0,if(eq($k,1),-5,if(eq($k,2),-3,-7)))"
  f="($root*pow(2,$st/12))"
  ph="mod(t,$b)"
  kick="sin(2*PI*(45+90*exp(-$ph*25))*$ph)*exp(-$ph*7)*0.9*$drive"
  hat="(random(0)*2-1)*exp(-mod(t+$b/2,$b)*70)*0.18*$drive"
  bass="sin(2*PI*$f/2*t)*0.22*exp(-$ph*3)"
  pad="(sin(2*PI*$f*t)+0.7*sin(2*PI*$f*1.4983*t)+0.4*sin(2*PI*$f*2*t))*0.07*(1-exp(-t*0.8))"
  ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='$kick+$hat+$bass+$pad':s=44100:d=$LENGTH" \
    -af "afade=t=in:d=0.3,afade=t=out:st=$((LENGTH-2)):d=2,alimiter=limit=0.9" \
    -metadata title="$name" -metadata copyright="CC0-1.0" -ac 1 -b:a 96k "$OUT/$name.mp3"
}

track drive-128 128 220 1
track lift-110 110 196 0.8
track glow-90 90 174.61 0.5
