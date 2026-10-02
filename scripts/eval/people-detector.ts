import { randomUUID } from 'node:crypto';
import { billedUsdInScope, withOrgContext } from '$lib/server/ai-log';
import { peopleDetector } from '$lib/server/moderation/moderation-config';
import { PeopleVerdict, ReferenceMedium } from '$lib/server/moderation/people';

const SAMPLES: ReadonlyArray<{ name: string; url: string; expected: PeopleVerdict }> = [
  { name: 'portrait', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=512', expected: PeopleVerdict.Present },
  { name: 'crowd at a concert', url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=512', expected: PeopleVerdict.Present },
  { name: 'statue of David', url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Michelangelo%27s_David_2015.jpg/500px-Michelangelo%27s_David_2015.jpg", expected: PeopleVerdict.Present },
  { name: 'product: smartwatch', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=512', expected: PeopleVerdict.Absent },
  { name: 'landscape: mountains', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=512', expected: PeopleVerdict.Absent },
  { name: 'cartoon: Tux penguin', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Tux.svg/330px-Tux.svg.png', expected: PeopleVerdict.Absent }
];

const orgId = randomUUID();
const detect = peopleDetector(orgId);
const quietErrors = console.error;
console.error = () => {};

let usd = 0;
let hits = 0;
for (const sample of SAMPLES) {
  const verdict = await withOrgContext(orgId, async () => {
    const answer = await detect({ medium: ReferenceMedium.Image, url: sample.url }).catch(() => PeopleVerdict.Unknown);
    usd += billedUsdInScope() ?? 0;
    return answer;
  });
  hits += verdict === sample.expected ? 1 : 0;
  console.log(`${verdict === sample.expected ? 'OK  ' : 'MISS'} ${sample.name.padEnd(24)} expected ${sample.expected.padEnd(8)} got ${verdict}`);
}

console.error = quietErrors;
console.log(JSON.stringify({ samples: SAMPLES.length, hits, usd: Number(usd.toFixed(4)) }));
