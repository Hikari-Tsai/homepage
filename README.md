# homepage
# Hikari的靜態網頁
前端位置 https://hikari-tsai.github.io/homepage/index.html

# 說明
這是使用付費版型Canvas所製作，不開放改作。如果有需要請直接到他們的頁面購買
https://themeforest.net/item/canvas-the-multipurpose-html5-template/9228123



# 作品集怎麼維護

作品集的卡片不是直接寫在 `index.html`，而是由資料檔產生：

| 檔案 | 用途 |
|---|---|
| `data/works.yml` | 每張作品卡片一筆（頁面上依日期由新到舊排列） |
| `data/authors.yml` | 作者名字 → YouTube 頻道，每位作者只寫一次 |
| `src/index.html` | 頁面其他部分的模板（作品區塊用 `<!-- @works -->` 標記） |
| `data/dates.json` | YouTube 上傳日、Spotify 發行日的快取（自動產生，不用手改） |
| `index.html` | **產生出來的結果，不要直接改** |

## 手動追加一首作品

### 步驟 1：在 `data/works.yml` 加一段

用任何文字編輯器打開 `data/works.yml`，在檔案裡任意位置（例如最上面）貼上一段。
**位置不影響順序**，頁面會自動依日期由新到舊排列。

每段以 `- ` 開頭，後面每一行縮排兩個空白，段落之間空一行：

```yaml
- title: 【COVER】歌名 / 原唱
  youtube: dQw4w9WgXcQ
  authors: [多帕]
  roles: [Vocal Recording, Vocal Mixing]
  note: Ensemble Music Studio，Austrian Audio OC818 + SSL BIG SIX
```

### 依作品類型複製範本

**YouTube 影片**（最常見）：`youtube` 填影片 ID，也就是網址
`https://www.youtube.com/watch?v=dQw4w9WgXcQ` 裡 `v=` 後面的 11 碼。
縮圖、彈出播放、標題連結、發布日期都會自動處理。

```yaml
- title: 【COVER】歌名 / 原唱
  youtube: dQw4w9WgXcQ
  authors: [魷魷, 多帕]
  roles: [Vocal Recording, Vocal Mixing]
  note: 宅錄，SHURE MV7
```

**Spotify 專輯或單曲**：在 Spotify 按「分享 → 嵌入」，複製嵌入碼裡 `src="..."` 的網址。
發行日期會自動抓。

```yaml
- title: 專輯名稱
  spotify: https://open.spotify.com/embed/album/xxxxxxxxxxxxxxxxxxxxxx?utm_source=generator
  link: https://open.spotify.com/album/xxxxxxxxxxxxxxxxxxxxxx
  authors: [宋德鶴]
  roles: [Vocal Recording, Full Mixing]
  note: 負責全專輯人聲錄音
```

單曲的嵌入播放器比較矮，可以加 `spotify_height: 152`。

**圖片＋外部連結**（展覽、活動、沒有影片的作品）：這類作品抓不到日期，記得自己填 `date`，
不然會排在最後。

```yaml
- title: 作品名稱
  image: images/albums/封面.jpg
  link: https://example.com/作品頁面
  authors: [廣原武豪]
  roles: [Full Mixing]
  date: 2025-03-01
```

圖片可以放在 `images/albums/` 資料夾用相對路徑，也可以直接貼圖片網址。

### `roles` 可以識別的寫法（決定作品分類篩選）

`roles` 會顯示在卡片上（♫ 那一行），同時自動決定這張卡片的分類 class，
讓上方「作品分類」下拉選單可以篩選到它。**只認得下表左欄的寫法**：

| `roles` 寫法 | 卡片上的 class | 「作品分類」選單中的項目 |
|---|---|---|
| `Vocal Recording` | `vocal-recording` | Vocal Recording |
| `Vocal Recording(Remote)` | `vocal-recording-remote` | Vocal Recording(Remote) |
| `Vocal Mixing` | `vocal-mixing` | Vocal Mixing |
| `Vocal Remixing` | `vocal-mixing` | Vocal Mixing |
| `Full Mixing` | `full-mixing` | Full Mixing |
| `Arrangement` | `arrange` | Arrangement |
| `Re-Arrangement` | `arrange` | Arrangement |
| `Composition` | `compose` | Composition |
| `BGM` | `bgm` | BGM |
| `SFX` | `sfx` | SFX |
| `Foley` | `foley` | Foley |
| `SynthV Tune` | `synthv-tune` | SynthV Tune |
| `MIDI Mockup` | `mockup` | MIDI Mockup |
| `Mastering` | `mastering` | Mastering |
| `Recording` | `recording` | （選單沒有這項） |
| `Live Recording` | `recording` | （選單沒有這項） |
| `Producter` | `producter` | （選單沒有這項） |
| `Piano` | `piano` | （選單沒有這項） |
| `Rough Mixing` | （不加 class） | （只顯示在卡片上，篩選不到） |

規則：

- **大小寫、空白、括號都要完全一樣**。例如 `vocal mixing`、`Vocal  Mixing`、`Vocal Recording (Remote)` 都認不得。
- 可以寫多個，用逗號分開：`roles: [Vocal Recording, Vocal Mixing, Mastering]`。
  卡片上會依你寫的順序顯示，分類則是每一項的 class 全部加上去。
- **寫了表上沒有的工作項目，產生頁面時會報錯**（GitHub Actions 會顯示紅色叉叉並指出是哪一筆），不會默默漏掉分類。
  例外：那一筆有寫 `filters` 時，分類以 `filters` 為準，`roles` 可以寫任何文字。
- 想讓分類和顯示的文字不同（例如顯示 `Composition, Arrangement, Full Mixing`，但也要能被 Vocal Recording 篩到），
  可以另外寫 `filters` 覆寫，這時 `roles` 只負責顯示：

  ```yaml
  roles: [Composition, Arrangement, Full Mixing]
  filters: [compose, arrange, full-mixing, vocal-recording]
  ```

- 想新增一種工作項目：
  1. 在 `tools/build.mjs` 的 `ROLE_FILTER` 加一行對照，例如 `'Sound Design': 'sound-design',`
  2. 想讓選單也能篩選它，在 `src/index.html` 的作品分類選單加一個項目：
     `<li><a href="#" class="dropdown-item" data-filter=".sound-design"><span>Sound Design</span></a></li>`

### 步驟 2：作者（第一次合作的人才需要）

`authors` 裡寫的名字，如果在 `data/authors.yml` 找得到，就會自動連到他的 YouTube 頻道。
新的合作對象要在 `data/authors.yml` 加一行：

```yaml
新作者名字: 頻道handle
```

handle 是頻道網址 `https://www.youtube.com/@xxxx` 裡 `@` 後面的部分。不是 YouTube 的話可以直接寫完整網址：

```yaml
新作者名字: https://www.instagram.com/xxxx
```

沒有加進 `authors.yml` 的名字會顯示成純文字，不會出錯。
多位作者用逗號分開：`authors: [魷魷, 多帕]`，頁面上會顯示成「魷魷、多帕」。

### 步驟 3：push 到 GitHub

```bash
git add data
git commit -m "新增作品：歌名"
git push
```

push 後 GitHub Actions 會自動產生頁面並部署，大約 1～2 分鐘後網站就會更新。
進度可以在 GitHub repo 的 **Actions** 分頁看到；如果資料寫錯，那裡會顯示紅色叉叉和錯誤訊息。

### （選用）push 前先在本機預覽

```bash
npm --prefix tools install   # 第一次才需要
node tools/build.mjs         # 產生 index.html，並補抓新作品的日期
```

然後用瀏覽器打開 `index.html` 確認。產生時如果資料有錯，會直接列出是第幾筆、哪裡有問題。

## 發布日期從哪裡來

- **YouTube**：用 YouTube Data API v3 查詢上傳日期。API 金鑰存在 GitHub repo 的 Secret `YOUTUBE_API_KEY`，
  只在 GitHub Actions 產生頁面時使用，不會出現在網頁上。金鑰在 Google Cloud 專案 `homepage-youtube` 裡，
  名稱是 `homepage-build`，限制只能呼叫 YouTube Data API v3。
- 本機執行時如果沒有設定 `YOUTUBE_API_KEY` 環境變數，會改用讀取影片頁面的方式抓日期。
- **Spotify**：讀取專輯／單曲頁面的發行日期。
- 抓到的日期存在 `data/dates.json`，之後只會查還沒有日期的作品。
- 想重新查詢所有 YouTube 日期：到 GitHub repo 的 **Actions → Build and deploy → Run workflow**，
  勾選「重新查詢所有 YouTube 影片的發布日期」後執行。

## 作品區的搜尋與載入更多

頁面上的作品區一次先顯示最新 12 張，下方有「載入更多」按鈕；搜尋框可以找標題、作者、工作項目、日期和描述，
空白分開的多個關鍵字要全部符合。這部分由 `js/portfolio.js` 處理，想改一次顯示的張數，改裡面的 `PAGE_SIZE`。

## 修改、隱藏、刪除作品

- **修改**：在 `data/works.yml` 找到那一段直接改。
- **暫時不顯示**：在那一段加一行 `hidden: true`。
- **刪除**：把整段（從 `- title:` 到下一個空行）刪掉。

## 所有欄位

| 欄位 | 必填 | 說明 |
|---|---|---|
| `title` | ✓ | 卡片標題，可以用 HTML |
| `youtube` / `spotify` / `disco` / `image` / `media_html` | 擇一 | 卡片上方的媒體。`disco` 是 disco.ac 嵌入網址；`media_html` 給特殊情況直接寫 HTML |
| `authors` | | 作者名字列表。要連到特定網址可寫 `{name: 名字, url: 網址}` |
| `roles` | ✓ | 工作項目，寫法見「`roles` 可以識別的寫法」 |
| `note` | | 卡片下方的描述，可以用 HTML（例如 `<br>` 換行） |
| `link` | | 標題的連結。YouTube 作品不用寫，預設連到影片 |
| `date` | | 手動指定日期（`2025-03-01`，也可以只寫 `2025`）。YouTube、Spotify 會自動抓，不用寫 |
| `popup` | | 標題點了是否用彈出視窗開（YouTube 預設 `true`，其他預設 `false`） |
| `image_link` | | 圖片的連結，預設和 `link` 相同 |
| `spotify_height` | | Spotify 播放器高度，預設 352 |
| `filters` | | 想覆寫自動分類時才寫，例如 `[full-mixing, compose]` |
| `hidden` | | 寫 `true` 就不顯示 |

## YAML 常見錯誤

- **縮排**：每段第一行是 `- `，後面的欄位要剛好縮排兩個空白，不能用 Tab。
- **冒號後要有空白**：`title: 歌名` 可以，`title:歌名` 不行。
- **需要加引號的情況**：文字裡有「`: `」（冒號加空白）、「` #`」（空白加井號），
  或開頭是 `[`、`{`、`#`、`*`、`&`、`!`、`|`、`>`、`'`、`"`、`%`、`@` 時，前後加雙引號：
  `note: "比例 1: 2"`。
- **列表**：`authors` 和 `roles` 用中括號、逗號分隔：`[A, B]`。名字裡有逗號的話那個名字要加引號。
- `#` 後面是註解，可以用來寫備註：`date: 2025-06-24  # 影片檔名上的日期`。
