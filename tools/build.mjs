// 依 data/works.yml、data/authors.yml 與 src/index.html 模板產生 index.html
// 用法：node tools/build.mjs            產生 index.html（新影片會自動補抓發布日期）
//       node tools/build.mjs --refresh  重新查詢所有 YouTube 影片的日期
//       node tools/build.mjs --check    只檢查資料，不寫檔
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (f) => join(root, f);
const checkOnly = process.argv.includes('--check');

// 角色 → 篩選分類（index.html 上方「作品分類」下拉選單用的 class）
const ROLE_FILTER = {
	'Vocal Recording': 'vocal-recording', 'Vocal Recording(Remote)': 'vocal-recording-remote',
	'Vocal Mixing': 'vocal-mixing', 'Vocal Remixing': 'vocal-mixing', 'Full Mixing': 'full-mixing',
	'Arrangement': 'arrange', 'Re-Arrangement': 'arrange', 'Composition': 'compose', 'BGM': 'bgm',
	'SFX': 'sfx', 'Foley': 'foley', 'SynthV Tune': 'synthv-tune', 'MIDI Mockup': 'mockup',
	'Mastering': 'mastering', 'Recording': 'recording', 'Live Recording': 'recording',
	'Producter': 'producter', 'Piano': 'piano',
};
const KNOWN_KEYS = new Set(['title', 'youtube', 'spotify', 'spotify_height', 'disco', 'image', 'image_link',
	'link', 'popup', 'authors', 'roles', 'filters', 'note', 'media_html', 'hidden', 'date']);

const works = yaml.load(readFileSync(p('data/works.yml'), 'utf8')) || [];
const authors = yaml.load(readFileSync(p('data/authors.yml'), 'utf8')) || {};
const datesPath = p('data/dates.json');
const dates = existsSync(datesPath) ? JSON.parse(readFileSync(datesPath, 'utf8')) : {};

const esc = (s) => String(s).replace(/&(?![#\w]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = (s) => String(s).replace(/&(?![#\w]+;)/g, '&amp;').replace(/"/g, '&quot;');

// ---------- 檢查資料 ----------
const problems = [];
works.forEach((w, i) => {
	const where = `第 ${i + 1} 筆（${w.title ?? '無標題'}）`;
	for (const k of Object.keys(w)) if (!KNOWN_KEYS.has(k)) problems.push(`${where}：不認得的欄位「${k}」`);
	if (w.youtube && !/^[\w-]{11}$/.test(w.youtube)) problems.push(`${where}：youtube 應該是 11 碼影片 ID`);
	for (const r of w.roles ?? []) if (!(r in ROLE_FILTER) && !w.filters && r !== 'Rough Mixing')
		problems.push(`${where}：角色「${r}」沒有對應的篩選分類，請在 tools/build.mjs 的 ROLE_FILTER 加上，或在作品加 filters`);
	if (![w.youtube, w.spotify, w.disco, w.image, w.media_html].some(Boolean)) problems.push(`${where}：沒有 youtube / spotify / disco / image / media_html 其中之一`);
});
if (problems.length) {
	console.error('資料有問題：\n' + problems.join('\n'));
	process.exit(1);
}

// ---------- 補抓發布日期（YouTube 上傳日、Spotify 發行日） ----------
// 快取的 key：YouTube 是影片 ID，Spotify 是 "spotify:album/ID" 或 "spotify:track/ID"
const ytId = (w) => w.youtube ?? (String(w.link ?? '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/) || [])[1];
const spotifyKey = (w) => {
	const m = String(w.spotify ?? '').match(/open\.spotify\.com\/(?:embed\/)?((?:album|track)\/[A-Za-z0-9]+)/);
	return m ? `spotify:${m[1]}` : null;
};
const dateKey = (w) => ytId(w) ?? spotifyKey(w);

async function fetchDate(key) {
	const spotify = key.startsWith('spotify:');
	const url = spotify ? `https://open.spotify.com/${key.slice(8)}` : `https://www.youtube.com/watch?v=${key}`;
	const page = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' } })).text();
	const m = spotify
		? page.match(/music:release_date" content="([^"]+)"/)
		: page.match(/itemprop="(?:datePublished|uploadDate)" content="([^"]+)"/) || page.match(/"(?:publishDate|uploadDate)":"([^"]+)"/);
	return m ? m[1] : null;
}

// YouTube Data API v3：有設定環境變數 YOUTUBE_API_KEY 時使用（GitHub Actions 由 Secret 提供），
// 一次最多查 50 部影片。沒有金鑰時（例如本機）退回讀取影片頁面。
async function fetchYouTubeDates(ids, apiKey) {
	const found = {};
	for (let i = 0; i < ids.length; i += 50) {
		const params = new URLSearchParams({ part: 'snippet', id: ids.slice(i, i + 50).join(','), fields: 'items(id,snippet/publishedAt)', key: apiKey });
		const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
		const body = await res.json();
		if (!res.ok) throw new Error(`YouTube API 回應 ${res.status}：${body?.error?.message ?? '未知錯誤'}`);
		for (const it of body.items ?? []) found[it.id] = it.snippet.publishedAt;
	}
	return found;
}

// --refresh：忽略快取，重新查詢所有 YouTube 影片的日期
const refresh = process.argv.includes('--refresh');
let missing = [...new Set(works.filter(w => !w.hidden && !w.date && dateKey(w) && (!dates[dateKey(w)] || (refresh && ytId(w)))).map(dateKey))];
const apiKey = process.env.YOUTUBE_API_KEY;
const ytMissing = missing.filter(k => !k.startsWith('spotify:'));
if (apiKey && ytMissing.length) {
	try {
		const found = await fetchYouTubeDates(ytMissing, apiKey);
		for (const id of ytMissing) {
			if (found[id]) { dates[id] = found[id]; console.log(`抓到發布日期（API）${id} ${found[id]}`); }
			else console.warn(`YouTube API 查不到 ${id}（影片可能已下架或設為私人），這張卡片先不顯示日期`);
		}
		missing = missing.filter(k => k.startsWith('spotify:'));
	} catch (e) {
		console.warn(`${e.message}，改用讀取影片頁面的方式`);
	}
} else if (ytMissing.length) {
	console.log('沒有設定 YOUTUBE_API_KEY，YouTube 日期改用讀取影片頁面的方式');
}
for (const key of missing) {
	try {
		const d = await fetchDate(key);
		if (d) { dates[key] = d; console.log(`抓到發布日期 ${key} ${d}`); }
		else console.warn(`找不到 ${key} 的發布日期，這張卡片先不顯示日期（也可以在作品加 date: YYYY-MM-DD）`);
	} catch (e) {
		console.warn(`抓取 ${key} 失敗：${e.message}`);
	}
}

const taipei = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });
function dateOf(w) {
	if (w.date != null) {
		// YAML 會把 2025-11-07 讀成 Date；也接受只寫年份（2020）或年月（"2020-05"）
		const text = w.date instanceof Date ? w.date.toISOString().slice(0, 10) : String(w.date);
		return { iso: text, text };
	}
	const iso = dateKey(w) && dates[dateKey(w)];
	if (!iso) return null;
	return { iso, text: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : taipei.format(new Date(iso)) };
}

// ---------- 產生卡片 ----------
function authorUrl(a) {
	if (typeof a === 'object') return a.url;
	const v = authors[a];
	if (!v) return null;
	return /^https?:\/\//.test(v) ? v : `https://www.youtube.com/@${encodeURIComponent(v).replace(/%2E/gi, '.')}`;
}
function authorHtml(list) {
	return list.map(a => {
		const name = typeof a === 'object' ? a.name : a;
		const url = authorUrl(a);
		return url ? `<a href="${attr(url)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name);
	}).join('、');
}

function mediaHtml(w) {
	if (w.youtube) return [
		`<a data-fancybox href="https://www.youtube.com/embed/${w.youtube}">`,
		`\t<div class="aspect-ratio-box">`,
		`\t\t<img data-src="https://img.youtube.com/vi/${w.youtube}/hqdefault.jpg" width="640" alt="${attr(w.title ?? '')}" loading="lazy">`,
		`\t</div>`,
		`</a>`];
	if (w.spotify) return [`<iframe style="border-radius:12px" data-src="${attr(w.spotify)}" width="100%" height="${w.spotify_height ?? 352}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`];
	if (w.disco) {
		const id = (w.disco.match(/\/e\/t\/(\d+)/) || [])[1];
		const idAttr = id ? `id="disco-track-${id}" name="disco-track-${id}" ` : '';
		return [`<iframe ${idAttr}allowfullscreen frameborder="0" class="disco-embed" data-src="${attr(w.disco)}" width="480" height="235" loading="lazy"></iframe>`];
	}
	if (w.image) return [`<a href="${attr(w.image_link ?? w.link ?? '#')}"><img data-src="${attr(w.image)}" alt="${attr(w.title ?? '')}" loading="lazy"></a>`];
	return w.media_html.trimEnd().split('\n');
}

function card(w) {
	const filters = w.filters ?? [...new Set((w.roles ?? []).map(r => ROLE_FILTER[r]).filter(Boolean))];
	const link = w.link ?? (w.youtube ? `https://www.youtube.com/watch?v=${w.youtube}` : '#');
	const popup = w.popup ?? Boolean(w.youtube);
	const d = dateOf(w);
	const L = [];
	L.push(`<div class="entry col-md-4 col-sm-6 col-12${filters.length ? ' ' + filters.join(' ') : ''}">`);
	L.push(`\t<div class="grid-inner">`);
	L.push(`\t\t<div class="entry-image">`);
	for (const l of mediaHtml(w)) L.push(`\t\t\t${l}`);
	L.push(`\t\t</div>`);
	if (w.title) {
		L.push(`\t\t<div class="entry-title">`);
		L.push(`\t\t\t<h2><a ${popup ? 'data-fancybox ' : ''}href="${attr(link)}">${w.title}</a></h2>`);
		L.push(`\t\t</div>`);
	}
	L.push(`\t\t<div class="entry-meta">`);
	L.push(`\t\t\t<ul>`);
	if (w.authors?.length) L.push(`\t\t\t\t<li><i class="uil bi-person-circle"></i>${authorHtml(w.authors)}</li>`);
	if (w.roles?.length) L.push(`\t\t\t\t<li><i class="bi-music-note-beamed"></i>${esc(w.roles.join(', '))}</li>`);
	if (d) L.push(`\t\t\t\t<li class="yt-date w-100"><i class="bi-calendar3"></i><time datetime="${attr(d.iso)}">${esc(d.text)}</time></li>`);
	L.push(`\t\t\t</ul>`);
	L.push(`\t\t</div>`);
	if (w.title) {
		L.push(`\t\t<div class="entry-content">`);
		L.push(`\t\t\t<p>${w.note ?? ''}</p>`);
		L.push(`\t\t</div>`);
	}
	L.push(`\t</div>`);
	L.push(`</div>`);
	return L;
}

const template = readFileSync(p('src/index.html'), 'utf8');
const nl = template.includes('\r\n') ? '\r\n' : '\n';
const marker = template.match(/^([ \t]*)<!-- @works[^\n]*?-->\r?$/m);
if (!marker) { console.error('src/index.html 裡找不到 <!-- @works --> 標記'); process.exit(1); }
const indent = marker[1];
// 依日期由新到舊排序；沒有日期的作品放最後，維持 works.yml 裡的順序
const sortKey = (w) => { const d = dateOf(w); return d ? d.text : ''; };
const visible = works.filter(w => !w.hidden)
	.map((w, i) => ({ w, i, k: sortKey(w) }))
	.sort((a, b) => (a.k === b.k ? a.i - b.i : a.k < b.k ? 1 : -1))
	.map(x => x.w);
const body = visible.flatMap(card).map(l => indent + l).join(nl);

if (checkOnly) {
	console.log(`資料正確：${visible.length} 張卡片（另有 ${works.length - visible.length} 張隱藏）`);
	process.exit(0);
}

const banner = `<!-- 此檔由 tools/build.mjs 自動產生，請勿直接修改。要改作品請改 data/works.yml，其他內容請改 src/index.html。 -->`;
const html = template.replace(marker[0], body).replace(/^(<!DOCTYPE html>\r?\n)/i, `$1${banner}${nl}`);
writeFileSync(p('index.html'), html);
writeFileSync(datesPath, JSON.stringify(Object.fromEntries(Object.entries(dates).sort()), null, 1) + '\n');
console.log(`已產生 index.html：${visible.length} 張卡片（另有 ${works.length - visible.length} 張隱藏）`);
