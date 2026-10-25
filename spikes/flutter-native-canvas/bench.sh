#!/bin/bash
# Runs the scripted bench (METHOD.md) on the built app, sampling RSS/CPU/GPU each second.
set -u
app="${1:?app path}"; out="${2:?out dir}"
start=$(python3 -c 'import time;print(int(time.time()*1000))')
FEEGA_BENCH=1 FEEGA_OUT="$out" "$app/Contents/MacOS/feega_canvas" > "$out/bench.log" 2>&1 &
pid=$!
echo "t_ms rss_kb cpu gpu" > "$out/samples.txt"
rm -f "$out/results.json"
while [ ! -f "$out/results.json" ] && kill -0 $pid 2>/dev/null; do
  now=$(python3 -c 'import time;print(int(time.time()*1000))')
  gpu=$(ioreg -r -d 1 -w 0 -c IOAccelerator | grep -o '"Device Utilization %"=[0-9]*' | head -1 | cut -d= -f2)
  echo "$((now-start)) $(ps -o rss=,%cpu= -p $pid) ${gpu:-?}" >> "$out/samples.txt"
  sleep 1
done
echo "launch_epoch_ms $start" >> "$out/samples.txt"
