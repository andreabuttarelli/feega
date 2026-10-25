# ponytail: composite native canvas PNGs under the transparent UI capture; build the video.
import json, os, subprocess, sys
from PIL import Image
raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
stage = json.load(open(os.path.join(raw, 'stage.json')))
names = sorted(f[:-7] for f in os.listdir(raw) if f.endswith('.ui.png'))
for n in names:
    ui = Image.open(os.path.join(raw, n + '.ui.png')).convert('RGBA')
    s = ui.width / (stage['left'] + stage['width'] + 280)
    base = Image.new('RGBA', ui.size, (233, 233, 236, 255))
    c = os.path.join(raw, n + '.canvas.png')
    if os.path.exists(c):
        base.alpha_composite(Image.open(c).convert('RGBA'), (round(stage['left'] * s), round(stage['top'] * s)))
    base.alpha_composite(ui)
    dest = os.path.join(out if not n.startswith('v') else raw, n + '.png')
    base.convert('RGB').save(dest)
frames = os.path.join(raw, 'v%04d.png')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', frames, '-vf', 'scale=1600:-2', '-pix_fmt', 'yuv420p', os.path.join(out, sys.argv[3] if len(sys.argv) > 3 else 'pan-zoom.mp4')], check=True)
