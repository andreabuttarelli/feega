p = 'packages/library/tools/interactive.mjs'
s = open(p).read()
a = s.index("        svelte: `<script lang=\"ts\">\n  ${pad(toastMount")
end = s.index("      };\n    }\n  }\n];")
block = s[a:end]
lines = block.split('\n')
out = [lines[0][2:] if lines[0].startswith('  ') else lines[0]]
out[0] = '        ' + lines[0].lstrip()
for l in lines[1:]:
    out.append(l[2:] if l.startswith('  ') else l)
fixed = '\n'.join(out)
fixed = fixed.replace("${pad(toastMount, 2)}", "${pad(toastMount, 2)}")
s = s[:a] + fixed + s[end:]
open(p, 'w').write(s)
