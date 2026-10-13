import { MotionFormat } from '$lib/motion/doc';
import type { LayoutId } from '$lib/canvas/composition/types';
import { BUILTIN_PREFIX } from './design-kit';
import { EdgeTone, Energy, Joint, MediaAspect, SectionRole, TextAmount, type MediaNeed, type OnScreenBeat, type TemplateCard } from './card';

const { Landscape: WIDE, Vertical: TALL, Square: SQUARE, Portrait: PORTRAIT } = MotionFormat;
const ALL_FORMATS = [WIDE, TALL, SQUARE, PORTRAIT];
const { Dark: DARK, Light: LIGHT, Colour: COLOUR } = EdgeTone;
const R = SectionRole;

const media = (min: number, max: number, aspect = MediaAspect.Any): MediaNeed => ({ min, max, aspect });
const beat = (from: number, to: number | undefined, what: string): OnScreenBeat => (to === undefined ? { from, what } : { from, to, what });

type Spec = Omit<TemplateCard, 'edges'> & { edges?: Partial<TemplateCard['edges']> };

const card = (spec: Spec): TemplateCard => ({ ...spec, edges: { start: DARK, end: DARK, transition: Joint.Cut, ...spec.edges } });

const APPLE = ['apple-minimal product video'];

const COMPOSITION_SECONDS = 6;

const COMPOSITIONS: Record<LayoutId, { what: string; energy: Energy; roles?: TemplateCard['roles'] }> = {
  'tilted-grid': { what: 'a tilted wall of cards sways back and forth while it scrolls', energy: Energy.Calm },
  'carousel-3d': { what: 'cards orbit a centre, the front one large', energy: Energy.Medium },
  'media-cloud': { what: 'cards drift through depth in a loose cloud', energy: Energy.Calm, roles: [R.Background, R.Gallery] },
  'media-ring': { what: 'stacked rings of cards turn in step', energy: Energy.Medium },
  helix: { what: 'a spiral of cards turns around its vertical axis', energy: Energy.Medium },
  'explorer-grid': { what: 'an endless grid glides from card to card, pausing on each', energy: Energy.Medium },
  'staggered-grid': { what: 'columns at offset heights scroll steadily', energy: Energy.Calm, roles: [R.Background, R.Gallery] },
  'vertical-flow': { what: 'a stream of cards rises through the frame, the middle one largest', energy: Energy.Calm },
  coverflow: { what: 'a front card with its neighbours angled away steps along', energy: Energy.Medium },
  ring: { what: 'cards curved on a tilted cylinder turn, the back ones showing through', energy: Energy.Medium },
  bento: { what: 'rounded cells of a bento grid enter in a cascade and hold', energy: Energy.Medium, roles: [R.Gallery, R.List] },
  marquee: { what: 'rows of cards glide in alternate directions, each at its own pace', energy: Energy.Calm, roles: [R.Background, R.Proof] },
  stack: { what: 'a pile of cards: the front one slides away and the next comes forward', energy: Energy.Medium },
  'perspective-wall': { what: 'a wall of media recedes in perspective and pans slowly', energy: Energy.Calm, roles: [R.Background, R.Gallery] },
  'film-strip': { what: 'a strip steps along, one card in focus at a time', energy: Energy.Medium },
  'split-reveal': { what: 'panels side by side part up and down to reveal the next set', energy: Energy.Fast, roles: [R.Gallery, R.Transition] },
  polaroid: { what: 'slightly turned prints drop onto a pile one after another', energy: Energy.Medium },
  masonry: { what: 'masonry columns of different widths scroll at different speeds', energy: Energy.Calm, roles: [R.Background, R.Gallery] },
  slider: { what: 'one media at a time in the centre, sliding or fading to the next', energy: Energy.Medium, roles: [R.Gallery, R.Product] }
};

function compositionCard(layout: LayoutId): TemplateCard {
  const c = COMPOSITIONS[layout];
  return card({
    roles: c.roles ?? [R.Gallery, R.Background],
    energy: c.energy,
    loops: true,
    onScreen: [beat(0, COMPOSITION_SECONDS, `${c.what}; no text, seamless loop (extend with loop)`)],
    needs: { media: media(4, 16), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: ['a portfolio or catalogue section', 'a backdrop under a title', 'many product shots or screens at once']
  });
}

const LAUNCH_CARDS: Record<string, TemplateCard> = {
  'launch-word-burst': card({
    roles: [R.Opener],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 0.5, 'word 1 punches in from blur on its own line'), beat(0.5, 1.5, 'words 2 and 3 punch in under it, one per beat'), beat(1.5, 3.5, 'word 4 lands in the accent; all four hold')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    goodFor: ['launch hook', 'a four-word claim']
  }),
  'launch-ui-speed-ramp': card({
    roles: [R.Product, R.Background],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 1, 'close on the page headline'), beat(1, 2, 'pulls back to the whole page and holds'), beat(2, 3.5, 'whips into one detail and keeps creeping')],
    needs: { media: media(1, 1, MediaAspect.Screenshot), text: TextAmount.None },
    bestFormats: [WIDE, SQUARE],
    goodFor: ['a website capture behind live UI', 'the move from hook to product']
  }),
  'launch-device-fly': card({
    roles: [R.Product],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 1, 'a laptop flies in from a 95° turn'), beat(1, 3, 'it keeps drifting closer, a huge line behind it')],
    needs: { media: media(1, 1, MediaAspect.Screenshot), text: TextAmount.Line },
    bestFormats: [WIDE, SQUARE],
    goodFor: ['the product on a laptop', 'first look at the app']
  }),
  'launch-number-match-cut': card({
    roles: [R.Stat, R.Proof],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 2, 'number 1 rises out of its box, its label small under it'), beat(2, 4, 'number 2 swaps in the same spot, in the accent')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    goodFor: ['two real numbers', 'proof before the close']
  }),
  'launch-ui-tilt-zoom': card({
    roles: [R.Feature, R.Background],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 1, 'a capture lands tilted back 18°'), beat(1, 2.5, 'it straightens while whipping in on the detail')],
    needs: { media: media(1, 1, MediaAspect.Screenshot), text: TextAmount.None },
    bestFormats: [WIDE, SQUARE],
    goodFor: ['one feature of the real UI', 'behind live UI']
  }),
  'launch-beat-montage': card({
    roles: [R.Feature, R.Transition],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 2, 'claim 1 punches in on black'), beat(2, 4.5, 'claim 2 replaces it in the same spot, in the accent')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['the build-up before the drop', 'two short claims']
  }),
  'launch-ui-explode': card({
    roles: [R.Gallery, R.Feature],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 0.5, 'white flash'), beat(0.5, 2, 'captures burst into a tilted 3D grid rushing at the camera'), beat(2, 3.5, 'the grid settles and dims, the claim lands on top')],
    needs: { media: media(8, 12, MediaAspect.Screenshot), text: TextAmount.Line },
    bestFormats: [WIDE, SQUARE],
    edges: { start: LIGHT },
    goodFor: ['the wow peak on the drop', 'many screens of one product']
  }),
  'launch-device-orbit': card({
    roles: [R.Product],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 1, 'a phone spins in 200°'), beat(1, 3, 'it keeps turning while one huge word slides behind it')],
    needs: { media: media(1, 1, MediaAspect.PhoneScreen), text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    goodFor: ['a mobile app', 'the product on a phone']
  }),
  'launch-logo-build': card({
    roles: [R.Closer],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'the light opens'), beat(1, 1.8, 'the logo lands flat with an accent shockwave'), beat(1.25, 2, 'the address appears'), beat(2, 4.5, 'the claim appears; all hold')],
    needs: { media: media(1, 1, MediaAspect.Logo), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['the close of a launch film', 'logo, address and claim']
  })
};

const SCENE_CARDS: Record<string, TemplateCard> = {
  'scene-hero-title': card({
    roles: [R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'one giant line snaps up word by word on black'), beat(0.5, 3, 'it holds, then fades')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('the claim as hook')
  }),
  'scene-eyebrow-title': card({
    roles: [R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'a small accent eyebrow snaps up'), beat(0.2, 3.5, 'a giant title snaps up under it and holds')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('introducing a product by name')
  }),
  'scene-feature-line': card({
    roles: [R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 3.5, 'one large sentence centred on black snaps up and holds')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('one benefit in words')
  }),
  'scene-feature-line-light': card({
    roles: [R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 3, 'one large black sentence on white snaps up and holds')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: APPLE.concat('a light beat between dark scenes')
  }),
  'scene-feature-accent': card({
    roles: [R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'a white line snaps up'), beat(0.3, 3.5, 'a second line in the accent snaps up under it; both hold')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('a promise and its payoff')
  }),
  'scene-big-number': card({
    roles: [R.Stat],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'a huge accent number settles in'), beat(0.2, 3.5, 'its small grey label rises under it; both hold')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('one real number')
  }),
  'scene-quote': card({
    roles: [R.Proof],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'a large quote snaps up'), beat(0.3, 4.5, 'the author in small grey type under it; both hold')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('one customer quote')
  }),
  'scene-split-statement': card({
    roles: [R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'a big statement snaps up on the left'), beat(0.3, 4, 'a small paragraph appears on the right; both hold')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: [WIDE, SQUARE],
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('a claim with its explanation')
  }),
  'scene-product-reveal': card({
    roles: [R.Product],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 0.5, 'the product fades in under a soft light'), beat(0.5, 4, 'slow push-in and pan, a small caption under it')],
    needs: { media: media(1, 1), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('a product photo', 'one readable section of a screenshot')
  }),
  'scene-ui-closeup': card({
    roles: [R.Product, R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 4, 'a screenshot full frame, cropped on its focus, pushing in and panning')],
    needs: { media: media(1, 1, MediaAspect.Screenshot), text: TextAmount.None },
    bestFormats: [WIDE, SQUARE],
    edges: { start: EdgeTone.Media, end: EdgeTone.Media, transition: Joint.Fade },
    goodFor: APPLE.concat('one detail of the app')
  }),
  'scene-ui-window': card({
    roles: [R.Product],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'one small line snaps up at the top'), beat(0.2, 4.5, 'a screenshot window drifts in slowly under it')],
    needs: { media: media(1, 1, MediaAspect.Screenshot), text: TextAmount.Line },
    bestFormats: [WIDE, SQUARE],
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('a whole app screen with a caption')
  }),
  'scene-device-hero': card({
    roles: [R.Product],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 0.5, 'a device fades in on black'), beat(0.5, 4, 'it turns a few degrees, the screenshot on its screen')],
    needs: { media: media(1, 1, MediaAspect.Screenshot), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('the app on a laptop or phone')
  }),
  'scene-device-split': card({
    roles: [R.Product, R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 0.5, 'a phone fades in on the right'), beat(0.2, 4, 'a large line snaps up on the left while the phone turns slightly')],
    needs: { media: media(1, 1, MediaAspect.PhoneScreen), text: TextAmount.Line },
    bestFormats: [WIDE, SQUARE],
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('a mobile feature with one line')
  }),
  'scene-media-caption': card({
    roles: [R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 4, 'a picture across the frame drifting'), beat(0.3, 4, 'one line in the black band under it')],
    needs: { media: media(1, 1, MediaAspect.Landscape), text: TextAmount.Line },
    bestFormats: [WIDE, SQUARE],
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('a photo with one line')
  }),
  'scene-dissolve': card({
    roles: [R.Transition, R.Gallery],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 2.2, 'picture 1 full frame, drifting'), beat(2.2, 3.4, 'picture 2 dissolves over it'), beat(3.4, 5, 'picture 2 drifts, then fades')],
    needs: { media: media(2, 2), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media, transition: Joint.Fade },
    goodFor: APPLE.concat('mood, before and after')
  }),
  'scene-match-cut': card({
    roles: [R.Opener, R.Transition],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 2, 'word 1 big on black'), beat(2, 3.9, 'cut to word 2 in the same place'), beat(3.9, 5.9, 'cut to word 3 in the accent')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.MatchCut },
    goodFor: APPLE.concat('three words on the beat')
  }),
  'scene-three-points': card({
    roles: [R.List],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0.1, 0.5, 'point 1 snaps up'), beat(0.25, 0.7, 'point 2 under it'), beat(0.4, 4.5, 'point 3 in the accent; all hold')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('three short benefits')
  }),
  'scene-logo-end-card': card({
    roles: [R.Closer],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.1, 0.6, 'the logo settles in the centre'), beat(0.3, 3.5, 'the address in small grey type under it; both hold')],
    needs: { media: media(1, 1, MediaAspect.Logo), text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: APPLE.concat('logo and website at the end')
  })
};

const DESIGN_CARDS: Record<string, TemplateCard> = {
  'lower-third': card({
    roles: [R.Background],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 0.4, 'an accent bar wipes in bottom left'), beat(0.2, 0.8, 'name on the bar, role rising under it'), beat(0.8, 5, 'holds, then fades')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: [WIDE, SQUARE],
    edges: { start: EdgeTone.Media, end: EdgeTone.Media, transition: Joint.Wipe },
    goodFor: ['naming a speaker over footage']
  }),
  'title-card': card({
    roles: [R.Opener, R.Transition],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0.2, 0.6, 'a small orange kicker rises'), beat(0.3, 4, 'a big two-line title under it; both hold, then fade')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: ['a chapter title', 'a title card between scenes']
  }),
  'product-reveal': card({
    roles: [R.Product],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 0.6, 'a product photo pops in on cream'), beat(0.6, 1.2, 'its name, then its price in orange'), beat(1.2, 5, 'all hold, then fade')],
    needs: { media: media(1, 1), text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: ['e-commerce product with price']
  }),
  'end-card': card({
    roles: [R.Closer],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 0.6, 'the logo pops in on black'), beat(0.3, 1, 'call to action, then the link in orange'), beat(1, 4, 'all hold')],
    needs: { media: media(1, 1, MediaAspect.Logo), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['call to action at the end']
  }),
  'social-stat': card({
    roles: [R.Stat],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 0.6, 'one big number pops in'), beat(0.4, 1, 'an orange rule wipes in, the label under it'), beat(1, 4, 'all hold, then fade')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media, transition: Joint.Fade },
    goodFor: ['one number over footage or a background']
  }),
  quote: card({
    roles: [R.Proof],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 0.3, 'a big orange quote mark on cream'), beat(0.3, 0.8, 'the quote, then its author rising'), beat(0.8, 5, 'all hold, then fade')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: ['a testimonial', 'a pull quote']
  })
};

const CUSTOM_CARDS: Record<string, TemplateCard> = {
  'ui-morph-reel': card({
    roles: [R.Feature, R.Product],
    energy: Energy.Fast,
    loops: true,
    onScreen: [beat(0, 28, 'one shape morphs through eleven UI states on the beat (button, toggle, toast…), a cursor driving each change, ~2.5 s per state')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: [SQUARE, WIDE, TALL],
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['interaction design', 'UI polish without a real screenshot']
  }),
  'prompt-input': card({
    roles: [R.Feature, R.Opener],
    energy: Energy.Medium,
    loops: true,
    onScreen: [beat(0, 1, 'an empty prompt box'), beat(1, 6, 'the camera follows the request typed at a human pace'), beat(6, 6.5, 'the cursor presses send'), beat(6.5, 8, 'it thinks'), beat(8, 9, 'back to the empty box')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['AI products', 'showing the request before the result']
  }),
  'floating-media': card({
    roles: [R.Opener, R.Gallery],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 1, 'a big title alone'), beat(1, 2, 'pictures fade in around it in 3D depth'), beat(2, 9, 'they drift slowly as if through water'), beat(9, 10, 'all fade out')],
    needs: { media: media(4, 12), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['brand mood opener', 'a title over the product photos']
  }),
  'photo-strip': card({
    roles: [R.Gallery],
    energy: Energy.Medium,
    loops: true,
    onScreen: [beat(0, 12, 'a strip of photos flicks sideways like a hand swiping; the one passing the middle grows large, then shrinks; small captions')],
    needs: { media: media(6, 16), text: TextAmount.Word },
    bestFormats: [WIDE, SQUARE],
    goodFor: ['a catalogue', 'a portfolio run', 'many products in one beat']
  }),
  'feature-scroll': card({
    roles: [R.List],
    energy: Energy.Fast,
    loops: false,
    onScreen: [beat(0, 1, 'the opening title enters'), beat(1, 4, 'a list of features scrolls past, readable'), beat(4, 8, 'it speeds up until it blurs'), beat(8, 12, 'it brakes into the closing title, which holds')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    goodFor: ['"everything you need" feature lists', '6–12 short features']
  }),
  'image-globe': card({
    roles: [R.Gallery, R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 2, 'pictures assemble into a 3D globe from a point'), beat(2, 3, 'the globe turns'), beat(3, 9, 'a title enters in front of it while it keeps turning'), beat(9, 10, 'all fade out')],
    needs: { media: media(8, 24), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['global reach', 'community', 'a big catalogue']
  }),
  'split-headline': card({
    roles: [R.Opener, R.Feature],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'a headline enters word by word'), beat(1, 2, 'an image grows between its two halves, pushing the words apart'), beat(2, 6, 'holds with the image inside the line'), beat(6, 8, 'the image closes and the line rejoins')],
    needs: { media: media(1, 1, MediaAspect.Landscape), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['a claim with one picture', 'editorial opener']
  }),
  'scroll-story': card({
    roles: [R.List, R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 3, 'chapter 1: pinned headline and its image on a visible grid'), beat(3, 8, 'the headline swaps line by line to chapter 2, its image drifts past'), beat(8, 12, 'chapter 3 swaps in and holds')],
    needs: { media: media(3, 3), text: TextAmount.Lines },
    bestFormats: [SQUARE, WIDE, TALL],
    goodFor: ['three steps or chapters', 'how it works', 'scroll-driven web embeds']
  }),
  'comment-grid': card({
    roles: [R.Proof],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 2, 'comment cards with avatars and stars enter from the centre out'), beat(2, 3, 'the grid drifts and dims'), beat(3, 12, 'a big title lands over it and holds')],
    needs: { media: media(0, 12, MediaAspect.Square), text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['reviews', '"loved by thousands"', 'social proof']
  }),
  'saas-monitor': card({
    roles: [R.Product, R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'a violet gradient with a big background word'), beat(1, 3, 'a desktop monitor rises into a tilted pose'), beat(3, 6, 'on its screen a website types its headline and hovers its button'), beat(6, 11, 'it scrolls to the product dashboard'), beat(11, 12, 'the monitor leaves')],
    needs: { media: media(0, 1, MediaAspect.Screenshot), text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { start: COLOUR, end: COLOUR },
    goodFor: ['SaaS landing page reveal', 'website to product in one shot']
  }),
  'phone-split': card({
    roles: [R.Product, R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'a phone rises from below into the centre'), beat(1, 2, 'the headline appears split on either side of it'), beat(2, 7, 'holds'), beat(7, 8, 'the phone drops away')],
    needs: { media: media(1, 1, MediaAspect.PhoneScreen), text: TextAmount.Line },
    bestFormats: [WIDE, SQUARE],
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['a mobile app hero', 'one claim with the app']
  }),
  marquee: card({
    roles: [R.Proof, R.Background],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 24, 'rows of logos and testimonial cards scroll sideways on their own, alternate rows in opposite directions; no title')],
    needs: { media: media(0, 16, MediaAspect.Logo), text: TextAmount.Lines },
    bestFormats: [WIDE, TALL, SQUARE],
    goodFor: ['customer logos', 'testimonials wall', 'trusted-by strip']
  }),
  'circular-carousel': card({
    roles: [R.Gallery, R.Product],
    energy: Energy.Medium,
    loops: true,
    onScreen: [beat(0, 12, 'pictures on a 3D ring, the front one large with its caption and round buttons; the ring turns one item every ~2 s')],
    needs: { media: media(5, 12, MediaAspect.Portrait), text: TextAmount.Word },
    bestFormats: [WIDE, SQUARE],
    goodFor: ['a product range', 'a collection', 'templates or examples']
  }),
  'parallax-grid': card({
    roles: [R.Gallery, R.Background],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 10, 'full-frame columns of pictures scroll up at different speeds; an optional title sits on top')],
    needs: { media: media(9, 24, MediaAspect.Portrait), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media },
    goodFor: ['a portfolio', 'a feed of work', 'a backdrop under a title']
  }),
  'parallax-grid-alternate': card({
    roles: [R.Gallery, R.Background],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 10, 'full-frame columns of pictures scroll in opposite directions, one up, the next down')],
    needs: { media: media(9, 24, MediaAspect.Portrait), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media },
    goodFor: ['a portfolio', 'a backdrop under a title']
  }),
  'parallax-grid-stagger': card({
    roles: [R.Gallery, R.Transition],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 2, 'columns of pictures start scrolling one after another, in a wave'), beat(2, 10, 'all scroll')],
    needs: { media: media(9, 24, MediaAspect.Portrait), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media },
    goodFor: ['a gallery entrance']
  }),
  'parallax-grid-zoom': card({
    roles: [R.Gallery, R.Background],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 10, 'columns at different depths scroll, wider ones faster, under a slow push-in')],
    needs: { media: media(9, 24, MediaAspect.Portrait), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media },
    goodFor: ['a deep gallery', 'a backdrop']
  }),
  'parallax-grid-drift': card({
    roles: [R.Background, R.Gallery],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 10, 'columns of pictures drift slowly and steadily, never stopping')],
    needs: { media: media(9, 24, MediaAspect.Portrait), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    edges: { start: EdgeTone.Media, end: EdgeTone.Media },
    goodFor: ['a calm backdrop under text']
  }),
  'rows-spaced-title': card({
    roles: [R.Opener, R.Closer],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 1, 'two rows of square photos glide in opposite directions, top and bottom'), beat(1, 4, 'the title words land one by one, set far apart, between them'), beat(4, 12, 'all hold and glide')],
    needs: { media: media(6, 16, MediaAspect.Square), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['a call to action with products', 'a calm editorial title']
  }),
  'scatter-title': card({
    roles: [R.Opener, R.Stat],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 1, 'the title fades in centred'), beat(0.5, 2, 'flat pictures scatter around the frame'), beat(2, 9, 'they drift slowly outward like an ad collage'), beat(9, 10, 'all fade out')],
    needs: { media: media(6, 14), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    goodFor: ['an offer or prize', 'editorial ad opener']
  }),
  'ring-through-title': card({
    roles: [R.Opener, R.Stat],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'a huge title fades in'), beat(1, 2, 'a tilted ring of pictures forms around it'), beat(2, 11, 'the ring turns, in front of the letters on one side, behind on the other'), beat(11, 12, 'all fade out')],
    needs: { media: media(10, 24), text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    goodFor: ['a short number or word', 'winners, community, a collection']
  }),
  'editorial-words-media': card({
    roles: [R.Feature, R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 15, 'very large words land phrase by phrase on a loose grid, ~2 s per phrase, pictures and clips opening in the empty cells beside them; each phrase fades as the next lands')],
    needs: { media: media(4, 8, MediaAspect.Landscape), text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    goodFor: ['a manifesto', 'a sentence told with pictures']
  }),
  'media-cloud-white': card({
    roles: [R.Background, R.Closer],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 12, 'the camera flies slowly through a dense cloud of small pictures on white'), beat(3, 12, 'a title fades in and holds on a clearing')],
    needs: { media: media(10, 40), text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: ['a bright closer', 'community or user content']
  }),
  'collage-stack-rotate': card({
    roles: [R.Gallery, R.Opener],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'a huge background word over a grid of small archive labels on a colour field'), beat(1, 7, 'pictures and white prints pile up one by one, each at its own angle'), beat(7, 10, 'the pile holds; the word scrolls behind it')],
    needs: { media: media(4, 10, MediaAspect.Portrait), text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { start: COLOUR, end: COLOUR },
    goodFor: ['fashion or editorial', 'an archive or collection']
  }),
  'melting-type-poster': card({
    roles: [R.Transition, R.Opener],
    energy: Energy.Medium,
    loops: true,
    onScreen: [beat(0, 1, 'a dark editorial poster page: big headline, number, small columns'), beat(1, 4, 'it crumbles top to bottom into fine sand'), beat(4, 6, 'the sand piles at the foot of an empty page'), beat(6, 9, 'it rises back into type'), beat(9, 10, 'the page holds whole')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: [PORTRAIT, SQUARE, TALL],
    goodFor: ['a poster or editorial piece', 'change, time, erosion']
  }),
  'poster-liquid-glass': card({
    roles: [R.Opener, R.Background],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 10, 'a Swiss poster on a grey wall: one huge word over dates and places; clear liquid glass flows over it, drops break away and melt back, bending the type')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: [PORTRAIT, SQUARE, TALL],
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['an event poster', 'a typographic statement']
  }),
  'phone-chat': card({
    roles: [R.Feature, R.Product],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'a phone close-up with an empty group chat'), beat(1, 7, 'each message types, then lands as a grey bubble with name and avatar, one every ~1.5 s, the camera slowly pushing in'), beat(7, 8, 'the last message lands'), beat(8, 9, 'the chat fades out')],
    needs: { media: media(0, 6, MediaAspect.Square), text: TextAmount.Lines },
    bestFormats: [SQUARE, TALL],
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['messaging or social apps', 'a conversation as a story']
  }),
  'wire-globe-pages': card({
    roles: [R.Gallery, R.Background],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 12, 'pages and pictures bent onto a slowly turning wireframe globe, the back side dimmed through the wire; no text')],
    needs: { media: media(8, 24), text: TextAmount.None },
    bestFormats: ALL_FORMATS,
    goodFor: ['global reach', 'a body of work', 'a backdrop under a title']
  }),
  'path-cards': card({
    roles: [R.Proof, R.Gallery],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 1, 'a blue dot on white starts drawing a curved path'), beat(1, 4, 'at its end a place card (photo, name, rating) and a review card pop in'), beat(4, 6, 'the path moves on, the cards fade, the next pair pops in'), beat(6, 12, 'a third stop, then the path fades and loops')],
    needs: { media: media(3, 6, MediaAspect.Landscape), text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: ['travel, places, maps', 'reviews along a journey']
  }),
  'word-wheel-ui': card({
    roles: [R.Feature, R.Product],
    energy: Energy.Medium,
    loops: true,
    onScreen: [beat(0, 1, '"New" alone on dark'), beat(1, 3, 'a word wheel beside it (Features / Interface / Upgrade) and a tilted dark app UI below'), beat(3, 12, 'every ~2.5 s the wheel turns to the next word and the UI swaps panel: cards, toggles, a bar chart')],
    needs: { media: null, text: TextAmount.Word },
    bestFormats: [SQUARE, TALL, WIDE],
    goodFor: ['a release or update', '"new features" with UI']
  }),
  'iridescent-blobs': card({
    roles: [R.Background, R.Opener],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 3, 'iridescent glossy blobs merge and split on black'), beat(3, 7, 'a title appears over them'), beat(7, 12, 'the blobs keep flowing without text')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: COLOUR, end: COLOUR, transition: Joint.Fade },
    goodFor: ['an abstract, premium mood', 'a backdrop under a claim']
  }),
  'particle-ribbon': card({
    roles: [R.Opener, R.Background],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 3, 'a grainy gradient ribbon of particles twists on cream'), beat(3, 4, 'it fades back'), beat(4, 6, 'a title holds over the faint ribbon'), beat(6, 10, 'the title leaves and the ribbon reforms')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: ['a soft brand opener', 'a calm title card']
  }),
  'bracket-gradient': card({
    roles: [R.Feature, R.Transition],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 1, 'a soft warm gradient drifts alone'), beat(1, 7, 'a thin sentence appears, four small corner marks opening from the centre around it, and holds'), beat(7, 8, 'the sentence fades, the marks close')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { start: COLOUR, end: COLOUR, transition: Joint.Fade },
    goodFor: ['one quiet statement', 'a pause between sections']
  }),
  'stack-words': card({
    roles: [R.Gallery, R.Closer],
    energy: Energy.Medium,
    loops: false,
    onScreen: [beat(0, 1, 'an empty light table'), beat(1, 4, 'portrait cards are dealt in from the left one after another, overlapping'), beat(4, 9, 'two words land above and below the last card and hold'), beat(9, 10, 'the cards slide out')],
    needs: { media: media(4, 8, MediaAspect.Portrait), text: TextAmount.Word },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT },
    goodFor: ['a collection with a two-word claim', 'before and after']
  }),
  'steps-list': card({
    roles: [R.List, R.Feature],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 1, 'a heading fades in on light grey'), beat(1, 5, 'steps with line icons land one by one along a thin rail, the newest highlighted, a shimmering "Working" label below'), beat(5, 11, 'the list holds'), beat(11, 12, 'all fade out')],
    needs: { media: null, text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    edges: { start: LIGHT, end: LIGHT, transition: Joint.Fade },
    goodFor: ['AI agents at work', 'how it works in steps']
  }),
  'flow-lines': card({
    roles: [R.Background, R.Opener],
    energy: Energy.Calm,
    loops: true,
    onScreen: [beat(0, 5, 'thousands of fine white strands swirl in a slow current on black'), beat(5, 8, 'the strands dim and a title holds alone over them'), beat(8, 10, 'the title leaves and the strands swirl back up')],
    needs: { media: null, text: TextAmount.Line },
    bestFormats: ALL_FORMATS,
    edges: { transition: Joint.Fade },
    goodFor: ['an abstract opener', 'a calm backdrop under a claim']
  }),
  'introducing-badge': card({
    roles: [R.Opener, R.List],
    energy: Energy.Calm,
    loops: false,
    onScreen: [beat(0, 1, '"Introducing" fades in on a dark field, a soft planet rising at the bottom'), beat(1, 2, 'a glass logo badge with the brand name'), beat(2, 13, 'a feature name in the accent under it, cycling every ~2 s'), beat(13, 14, 'all fade out')],
    needs: { media: media(0, 1, MediaAspect.Logo), text: TextAmount.Lines },
    bestFormats: ALL_FORMATS,
    goodFor: ['product launch opener', 'introducing a brand with its features']
  })
};

const COMPOSITION_CARDS = Object.fromEntries((Object.keys(COMPOSITIONS) as LayoutId[]).map((layout) => [`composition-${layout}`, compositionCard(layout)]));

export const TEMPLATE_CARDS: Record<string, TemplateCard> = Object.fromEntries(
  Object.entries({ ...LAUNCH_CARDS, ...SCENE_CARDS, ...DESIGN_CARDS, ...COMPOSITION_CARDS, ...CUSTOM_CARDS }).map(([id, c]) => [`${BUILTIN_PREFIX}${id}`, c])
);

export const templateCard = (id: string): TemplateCard | null => TEMPLATE_CARDS[id] ?? null;
