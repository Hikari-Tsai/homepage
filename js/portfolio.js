// 作品集：分類篩選 + 搜尋 + 載入更多
// 三者一起決定哪些卡片顯示，最後交給 Canvas 內建的 Isotope 排版。
(function () {
	var PAGE_SIZE = 24; // 一開始顯示幾張，每按一次「載入更多」再多顯示幾張

	var grid = document.getElementById('posts');
	var input = document.getElementById('works-search');
	var moreBtn = document.getElementById('works-more-btn');
	var emptyMsg = document.getElementById('works-empty');
	if (!grid || !input || !moreBtn) return;

	var items = Array.prototype.slice.call(grid.querySelectorAll(':scope > .entry'));
	var state = { category: '*', categoryLabel: '', query: '', limit: PAGE_SIZE, rest: 0 };

	// 搜尋範圍：標題、作者、工作項目、日期、描述
	function normalize(s) {
		return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
	}
	items.forEach(function (el) {
		var parts = ['.entry-title', '.entry-meta', '.entry-content'].map(function (sel) {
			var n = el.querySelector(sel);
			return n ? n.textContent : '';
		});
		el._searchText = normalize(parts.join(' '));
	});

	function matches(el) {
		if (state.category !== '*' && !el.matches(state.category)) return false;
		if (!state.query) return true;
		// 空白分開的每個關鍵字都要符合
		return state.query.split(' ').every(function (word) {
			return el._searchText.indexOf(word) !== -1;
		});
	}

	// 延後載入：卡片真的被顯示時才載入影片和推文，沒顯示的卡片不下載
	var twitterRequested = false;
	var relayoutTimer = null;
	var resizeObserver = window.ResizeObserver ? new ResizeObserver(function () {
		clearTimeout(relayoutTimer);
		relayoutTimer = setTimeout(function () { if (iso) iso.layout(); }, 100);
	}) : null;
	function activate(el) {
		if (el._activated) return;
		el._activated = true;
		// <source data-src> / <img data-src> / <iframe data-src>：補上 src
		var lazy = el.querySelectorAll('[data-src]');
		lazy.forEach(function (m) { m.setAttribute('src', m.getAttribute('data-src')); m.removeAttribute('data-src'); });
		el.querySelectorAll('video').forEach(function (v) { if (lazy.length) v.load(); });
		// 圖片、推文載入後卡片高度會變，自動重新排版
		if (resizeObserver) resizeObserver.observe(el);
		// 推文：第一次有推文卡片顯示時才載入 Twitter 的程式
		if (el.querySelector('blockquote.twitter-tweet')) {
			if (window.twttr && twttr.widgets) {
				twttr.widgets.load(el);
			} else if (!twitterRequested) {
				twitterRequested = true;
				var s = document.createElement('script');
				s.async = true;
				s.src = 'https://platform.twitter.com/widgets.js';
				s.charset = 'utf-8';
				document.body.appendChild(s);
			}
		}
	}

	var iso = null;
	function apply() {
		var matched = items.filter(matches);
		var shown = new Set(matched.slice(0, state.limit));
		shown.forEach(activate);
		var filterFn = function (a) {
			var el = a instanceof Element ? a : this; // 相容不同版本 Isotope 的呼叫方式
			return shown.has(el);
		};
		if (iso) {
			iso.arrange({ filter: filterFn });
		} else {
			items.forEach(function (el) { el.style.display = shown.has(el) ? '' : 'none'; });
		}
		state.rest = matched.length - shown.size;
		moreBtn.hidden = state.rest <= 0;
		updateTexts();
		emptyMsg.hidden = matched.length > 0;
	}

	// 會隨語言切換的文字（翻譯在 data/i18n.yml，由 js/i18n.js 提供）
	function t(key, vars, fallback) {
		return window.I18N ? I18N.t(key, vars) : fallback;
	}
	var filterBtn = document.getElementById('grid-filter-btn');
	function updateTexts() {
		moreBtn.textContent = t('ui.load_more', { n: state.rest }, '載入更多（還有 ' + state.rest + ' 件）');
		// 選了分類時按鈕顯示分類名稱（英文）；All 時顯示各語言的「作品分類 (ALL)」
		if (filterBtn && state.category !== '*') filterBtn.textContent = state.categoryLabel;
		else if (filterBtn && window.I18N) filterBtn.innerHTML = I18N.t('works.02');
	}
	document.addEventListener('i18n:change', updateTexts);

	// 分類選單（取代 Canvas 原本的綁定，才能和搜尋、載入更多一起運作）
	document.querySelectorAll('#dropdown-filter [data-filter]').forEach(function (a) {
		a.addEventListener('click', function (e) {
			e.preventDefault();
			state.category = a.getAttribute('data-filter') || '*';
			state.categoryLabel = a.textContent.trim();
			state.limit = PAGE_SIZE;
			apply();
			// 點選後收起選單
			var menu = a.closest('.dropdown');
			if (menu) menu.querySelectorAll('.show').forEach(function (n) { n.classList.remove('show'); });
		});
	});

	var clearBtn = document.getElementById('works-search-clear');
	var timer = null;
	function search(now) {
		clearTimeout(timer);
		if (clearBtn) clearBtn.hidden = input.value === '';
		var run = function () {
			var q = normalize(input.value);
			if (q === state.query) return;
			state.query = q;
			state.limit = PAGE_SIZE;
			apply();
		};
		if (now) run(); else timer = setTimeout(run, 150);
	}
	function clearSearch() {
		input.value = '';
		search(true);
		input.focus();
	}
	input.addEventListener('input', function () { search(false); });
	input.addEventListener('search', function () { search(true); }); // 部分瀏覽器按 Enter 或內建清除時觸發
	input.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && input.value) { e.preventDefault(); clearSearch(); }
	});
	if (clearBtn) clearBtn.addEventListener('click', clearSearch);

	moreBtn.addEventListener('click', function () {
		state.limit += PAGE_SIZE;
		apply();
	});

	// 等 Canvas 建好 Isotope 再接手；等不到（例如外掛載入失敗）就直接用 display 切換
	var tries = 0;
	(function waitForIsotope() {
		var inst = window.jQuery && jQuery(grid).data('isotope');
		if (inst) {
			iso = inst;
			apply();
		} else if (++tries < 100) {
			setTimeout(waitForIsotope, 100);
		} else {
			apply();
		}
	})();
})();
