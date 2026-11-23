// 作品集：分類篩選 + 搜尋 + 載入更多
// 三者一起決定哪些卡片顯示，最後交給 Canvas 內建的 Isotope 排版。
(function () {
	var PAGE_SIZE = 12; // 一次顯示幾張

	var grid = document.getElementById('posts');
	var input = document.getElementById('works-search');
	var moreBtn = document.getElementById('works-more-btn');
	var emptyMsg = document.getElementById('works-empty');
	if (!grid || !input || !moreBtn) return;

	var items = Array.prototype.slice.call(grid.querySelectorAll(':scope > .entry'));
	var state = { category: '*', query: '', limit: PAGE_SIZE };

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

	var iso = null;
	function apply() {
		var matched = items.filter(matches);
		var shown = new Set(matched.slice(0, state.limit));
		var filterFn = function (a) {
			var el = a instanceof Element ? a : this; // 相容不同版本 Isotope 的呼叫方式
			return shown.has(el);
		};
		if (iso) {
			iso.arrange({ filter: filterFn });
		} else {
			items.forEach(function (el) { el.style.display = shown.has(el) ? '' : 'none'; });
		}
		var rest = matched.length - shown.size;
		moreBtn.hidden = rest <= 0;
		moreBtn.textContent = '載入更多（還有 ' + rest + ' 件）';
		emptyMsg.hidden = matched.length > 0;
	}

	// 分類選單（取代 Canvas 原本的綁定，才能和搜尋、載入更多一起運作）
	document.querySelectorAll('#dropdown-filter [data-filter]').forEach(function (a) {
		a.addEventListener('click', function (e) {
			e.preventDefault();
			state.category = a.getAttribute('data-filter') || '*';
			state.limit = PAGE_SIZE;
			apply();
		});
	});

	var timer = null;
	input.addEventListener('input', function () {
		clearTimeout(timer);
		timer = setTimeout(function () {
			state.query = normalize(input.value);
			state.limit = PAGE_SIZE;
			apply();
		}, 150);
	});

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
