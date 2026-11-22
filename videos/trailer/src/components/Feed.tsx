import type { CSSProperties } from "react";
import { SANS } from "../theme";
import { Mark, MARKS } from "./brandIcons";
import { PixelgodLogo } from "./Terminal";

import { Cat, CatAvatar } from "./CatAvatar";

export type Post = {
  name: string;
  handle: string;
  age: string;
  text: string;
  cat: Cat;
  hue: number;
  media: boolean;
  stats: [string, string, string, string];
};

const POSTS: Post[] = [
  { name: "Kev Growth", handle: "growth_hacker_kev", age: "2m", text: "My app has reached 10.5B users in 2 weeks", cat: Cat.Tabby, hue: 200, media: false, stats: ["8.2K", "31K", "204K", "9.1M"] },
  { name: "Tom Founder", handle: "founder_mode_tom", age: "6m", text: "Quit my job. Built a unicorn over the weekend.", cat: Cat.CoolBlack, hue: 30, media: false, stats: ["12K", "40K", "388K", "14M"] },
  { name: "Brad Ships", handle: "ship_daily_brad", age: "11m", text: "Shipped 47 SaaS today. Bored.", cat: Cat.Grey, hue: 280, media: false, stats: ["3.4K", "9.9K", "77K", "2.2M"] },
  { name: "Thread Lord", handle: "thread_lord_99", age: "18m", text: "Thank me later 🧵", cat: Cat.Calico, hue: 120, media: true, stats: ["21K", "66K", "512K", "31M"] },
  { name: "Zack Prompt", handle: "prompt_daddy_zack", age: "25m", text: "Designers are cooked 💀", cat: Cat.White, hue: 340, media: false, stats: ["44K", "12K", "290K", "18M"] },
  { name: "Gary Alpha", handle: "alpha_grindset_gary", age: "31m", text: "WHAT?!", cat: Cat.Siamese, hue: 170, media: false, stats: ["9K", "27K", "143K", "6.6M"] },
  { name: "Max Hype", handle: "max_hype_ai", age: "44m", text: "This changes everything. Again.", cat: Cat.HoodieOrange, hue: 20, media: false, stats: ["17K", "52K", "401K", "22M"] },
  { name: "Ron Exit", handle: "exit_in_6_days", age: "52m", text: "Sold my startup before writing the code. AMA", cat: Cat.Black, hue: 240, media: false, stats: ["5.5K", "14K", "96K", "4.4M"] },
  { name: "Liam Moat", handle: "no_moat_liam", age: "1h", text: "Replaced my cofounder with a cron job 📈", cat: Cat.Tabby, hue: 50, media: false, stats: ["7.7K", "19K", "120K", "5.3M"] },
  { name: "Ace Agentic", handle: "agentic_ace", age: "2h", text: "100x engineer is the new 10x. Keep up.", cat: Cat.Grey, hue: 260, media: false, stats: ["11K", "35K", "260K", "12M"] },
];

export const HOOK: Post = {
  name: "Chad Visionary",
  handle: "ai_10x_chad",
  age: "1h",
  text: "Your AI can now replace a team of 100 designers 🤯\n\nPerfect UI. First try. Just run npx pixelgod",
  cat: Cat.CoolOrange,
  hue: 45,
  media: false,
  stats: ["12.4K", "48.1K", "391K", "18.2M"],
};

export const HOOK_INDEX = POSTS.length;

const AVATAR = 48;
const TEXT_LINE = 26;
const MEDIA = 260;
const POST_PAD = 32;
const ACTIONS = 44;
const LINK_CARD = 230;
const HOOK_EXTRA = LINK_CARD + 12;
const STAT_WIDTH = 74;

const postHeight = (post: Post) => {
  const lines = post.text ? post.text.split("\n").length : 0;

  return POST_PAD + 24 + lines * TEXT_LINE + (post.media ? MEDIA + 12 : 0) + ACTIONS + (post === HOOK ? HOOK_EXTRA : 0);
};

const FEED = [...POSTS, HOOK, ...POSTS.slice(0, 4)];

const tops = FEED.reduce<number[]>((acc, post, i) => [...acc, i === 0 ? 0 : acc[i - 1] + postHeight(FEED[i - 1])], []);

export const HOOK_HEIGHT = postHeight(HOOK);

export const HOOK_CENTER =tops[HOOK_INDEX] + postHeight(HOOK) / 2;

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const X = { text: "#e7e9ea", muted: "#71767b", line: "#2f3336", blue: "#1d9bf0", pink: "#f91880", card: "#16181c" };

const STAT_ICONS = [
  "M3 11a8 8 0 0 1 8-8h2a8 8 0 0 1 0 16h-1l-5 3v-3.6A8 8 0 0 1 3 11z",
  "M4 8l3-3 3 3M7 5v10a2 2 0 0 0 2 2h5M20 16l-3 3-3-3M17 19V9a2 2 0 0 0-2-2h-5",
  "M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z",
  "M5 20V12M10 20V5M15 20v-9M20 20v-4",
];

const BOOKMARK = "M6 3h12v18l-6-4-6 4z";
const SHARE = "M12 3v12M7 8l5-5 5 5M4 14v6h16v-6";
const LIKE_INDEX = 2;

const Verified = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z" fill={X.blue} />
    <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LinkCard = ({ scale }: { scale: number }) => (
  <div style={{ marginTop: 12 * scale, height: LINK_CARD * scale, borderRadius: 16, border: `1px solid ${X.line}`, overflow: "hidden", position: "relative", background: "radial-gradient(ellipse at 30% 20%, #4c1d95 0%, #0b0614 70%)" }}>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 * scale }}>
      <PixelgodLogo size={56 * scale} />
      <span style={{ fontSize: 40 * scale, fontWeight: 800, letterSpacing: 3, color: "#fff" }}>PIXELGOD</span>
    </div>
    <div style={{ position: "absolute", left: 12 * scale, bottom: 12 * scale, padding: `${2 * scale}px ${6 * scale}px`, borderRadius: 4, background: "rgba(0,0,0,0.75)", fontSize: 13 * scale, color: X.text }}>pixelgod.dev</div>
  </div>
);

export const PostCard = ({ post, scale = 1, liked = 0 }: { post: Post; scale?: number; liked?: number }) => {
  const big = post.handle === HOOK.handle;
  const fs = (n: number) => n * scale;

  return (
    <div style={{ display: "flex", gap: 12, padding: `${12 * scale}px ${16 * scale}px`, fontFamily: SANS, color: X.text }}>
      <CatAvatar cat={post.cat} size={AVATAR * scale} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: fs(15), display: "flex", gap: 4, alignItems: "center" }}>
          <b>{post.name}</b>
          <Verified size={fs(18)} />
          <span style={{ color: X.muted, marginLeft: 2 }}>
            @{post.handle} · {post.age}
          </span>
          <span style={{ marginLeft: "auto", color: X.muted, letterSpacing: 1 }}>···</span>
        </div>
        {post.text && (
          <div style={{ fontSize: fs(big ? 21 : 17), lineHeight: 1.3, marginTop: 4, whiteSpace: "pre-line", fontWeight: big ? 500 : 400 }}>{post.text}</div>
        )}
        {big && <LinkCard scale={scale} />}
        {post.media && (
          <div
            style={{
              marginTop: 12,
              height: MEDIA * scale,
              borderRadius: 16,
              border: `1px solid ${X.line}`,
              background: `linear-gradient(160deg, hsl(${post.hue} 70% 55%), hsl(${post.hue + 60} 60% 22%))`,
            }}
          />
        )}
        <div style={{ display: "flex", alignItems: "center", marginTop: 12 * scale, color: X.muted, fontSize: fs(13), fontVariantNumeric: "tabular-nums" }}>
          {STAT_ICONS.map((d, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: STAT_WIDTH * scale, flex: 1, color: i === LIKE_INDEX && liked > 0.5 ? X.pink : undefined }}>
              <Icon d={d} />
              {post.stats[i]}
            </span>
          ))}
          <span style={{ display: "flex", gap: 14 }}>
            <Icon d={BOOKMARK} />
            <Icon d={SHARE} />
          </span>
        </div>
      </div>
    </div>
  );
};

const NAV = [
  { label: "Home", d: "M3 10.5l9-7 9 7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { label: "Explore", d: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L21 21" },
  { label: "Notifications", d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" },
  { label: "Messages", d: "M3 5h18v14H3zM3 6l9 7 9-7" },
  { label: "Grok", d: "" },
  { label: "Bookmarks", d: BOOKMARK },
  { label: "Communities", d: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M17 14a6 6 0 0 1 4 6" },
  { label: "Premium", d: "" },
  { label: "Profile", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
  { label: "More", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12h.01M12 12h.01M16 12h.01" },
];

const NAV_MARKS: Record<string, typeof MARKS.x> = { Grok: MARKS.grok, Premium: MARKS.x };

const TRENDS = [
  { topic: "Trending in Technology", tag: "#DesignersAreCooked", posts: "412K posts" },
  { topic: "Technology · Trending", tag: "10x Founders", posts: "98.4K posts" },
  { topic: "Trending", tag: "#ShipItFriday", posts: "51.2K posts" },
  { topic: "Business · Trending", tag: "Weekend Unicorn", posts: "33K posts" },
];

const column: CSSProperties = { position: "absolute", top: 0, bottom: 0 };

type Props = {
  offset: number;
  blur: number;
  hideHook: boolean;
};

export const FEED_LEFT = 420;
export const FEED_WIDTH = 600;
const NAV_LEFT = 170;

const Nav = () => (
  <div style={{ ...column, left: NAV_LEFT, width: FEED_LEFT - NAV_LEFT - 20, display: "flex", flexDirection: "column", paddingTop: 10, color: X.text, fontFamily: SANS }}>
    <div style={{ padding: "8px 12px 14px" }}>
      <Mark mark={MARKS.x} size={30} color={X.text} />
    </div>
    {NAV.map((n, i) => (
      <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 18, padding: "11px 12px", fontSize: 20, fontWeight: i === 0 ? 700 : 400 }}>
        {NAV_MARKS[n.label] ? <Mark mark={NAV_MARKS[n.label]} size={24} color={X.text} /> : <Icon d={n.d} size={26} />}
        {n.label}
      </div>
    ))}
    <div style={{ marginTop: 14, height: 52, borderRadius: 26, background: "#eff3f4", color: "#0f1419", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, width: 220 }}>Post</div>
  </div>
);

const Sidebar = () => (
  <div style={{ ...column, left: FEED_LEFT + FEED_WIDTH + 30, width: 350, paddingTop: 8, display: "flex", flexDirection: "column", gap: 16, fontFamily: SANS, color: X.text }}>
    <div style={{ height: 44, borderRadius: 22, background: "#202327", display: "flex", alignItems: "center", gap: 12, padding: "0 18px", color: X.muted, fontSize: 15 }}>
      <Icon d={NAV[1].d} size={18} />
      Search
    </div>
    <div style={{ borderRadius: 16, border: `1px solid ${X.line}`, padding: "12px 16px" }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Subscribe to Premium</div>
      <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.3 }}>Subscribe to unlock new features and if eligible, receive a share of revenue.</div>
      <div style={{ marginTop: 12, height: 36, width: 110, borderRadius: 18, background: X.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>Subscribe</div>
    </div>
    <div style={{ borderRadius: 16, border: `1px solid ${X.line}`, padding: "12px 0" }}>
      <div style={{ fontSize: 20, fontWeight: 800, padding: "0 16px 6px" }}>What’s happening</div>
      {TRENDS.map((t) => (
        <div key={t.tag} style={{ padding: "10px 16px" }}>
          <div style={{ fontSize: 13, color: X.muted }}>{t.topic}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{t.tag}</div>
          <div style={{ fontSize: 13, color: X.muted, marginTop: 2 }}>{t.posts}</div>
        </div>
      ))}
    </div>
  </div>
);

const Tab = ({ label, active }: { label: string; active: boolean }) => (
  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", color: active ? X.text : X.muted, fontWeight: active ? 700 : 500 }}>
    {label}
    {active && <div style={{ position: "absolute", bottom: 0, width: 56, height: 4, borderRadius: 2, background: X.blue }} />}
  </div>
);

export const Feed = ({ offset, blur, hideHook }: Props) => (
  <div style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}>
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <filter id="scrollblur">
        <feGaussianBlur stdDeviation={`0 ${blur}`} />
      </filter>
    </svg>

    <Nav />

    <div style={{ ...column, left: FEED_LEFT, width: FEED_WIDTH, borderLeft: `1px solid ${X.line}`, borderRight: `1px solid ${X.line}` }}>
      <div style={{ position: "absolute", inset: 0, filter: blur > 0.3 ? "url(#scrollblur)" : undefined }}>
        <div style={{ transform: `translateY(${-offset}px)` }}>
          {FEED.map((post, i) => (
            <div key={i} style={{ height: postHeight(post), borderBottom: `1px solid ${X.line}`, opacity: hideHook && i === HOOK_INDEX ? 0 : 1 }}>
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 53, background: "rgba(0,0,0,0.85)", borderBottom: `1px solid ${X.line}`, display: "flex", fontFamily: SANS, fontSize: 15 }}>
        <Tab label="For you" active />
        <Tab label="Following" active={false} />
      </div>
    </div>

    <Sidebar />
  </div>
);
