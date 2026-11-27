// 語言切換（中文／English／日本語），不重新載入頁面。
// 翻譯資料由 tools/build.mjs 從 data/i18n.yml 產生，嵌在頁面的 <script id="i18n-data">。
// 會套用的元素：data-i18n（內文）、data-i18n-placeholder、data-i18n-aria-label。
(function () {
	var LANGS = ['zh', 'en', 'ja'];
	var HTML_LANG = { zh: 'zh-Hant', en: 'en', ja: 'ja' };
	var STORAGE_KEY = 'lang';

	var dataEl = document.getElementById('i18n-data');
	if (!dataEl) return;
	var dict;
	try { dict = JSON.parse(dataEl.textContent); } catch (e) { return; }

	function t(key, vars, lang) {
		lang = lang || I18N.lang;
		var v = (dict[lang] && dict[lang][key]) != null ? dict[lang][key] : (dict.zh[key] != null ? dict.zh[key] : key);
		if (vars) v = v.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
		return v;
	}

	function save(lang) {
		try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 無痕模式等情況存不了，沒關係 */ }
	}

	function detect() {
		var param = new URLSearchParams(location.search).get('lang');
		if (LANGS.indexOf(param) !== -1) { save(param); return param; }
		try {
			var saved = localStorage.getItem(STORAGE_KEY);
			if (LANGS.indexOf(saved) !== -1) return saved;
		} catch (e) { /* ignore */ }
		var prefs = navigator.languages || [navigator.language || ''];
		for (var i = 0; i < prefs.length; i++) {
			var p = String(prefs[i]).toLowerCase();
			if (p.indexOf('zh') === 0) return 'zh';
			if (p.indexOf('ja') === 0) return 'ja';
			if (p.indexOf('en') === 0) return 'en';
		}
		return 'en';
	}

	function apply(lang) {
		I18N.lang = lang;
		document.documentElement.lang = HTML_LANG[lang];
		document.querySelectorAll('[data-i18n]').forEach(function (el) {
			var v = t(el.getAttribute('data-i18n'), null, lang);
			if (el.innerHTML !== v) el.innerHTML = v;
		});
		['placeholder', 'aria-label'].forEach(function (attr) {
			document.querySelectorAll('[data-i18n-' + attr + ']').forEach(function (el) {
				el.setAttribute(attr, t(el.getAttribute('data-i18n-' + attr), null, lang));
			});
		});
		document.querySelectorAll('#lang-switch [data-lang]').forEach(function (b) {
			var on = b.getAttribute('data-lang') === lang;
			b.classList.toggle('active', on);
			b.setAttribute('aria-pressed', on ? 'true' : 'false');
		});
		document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
	}

	var I18N = window.I18N = {
		lang: 'zh',
		t: function (key, vars) { return t(key, vars); },
		set: function (lang) {
			if (LANGS.indexOf(lang) === -1 || lang === I18N.lang) return;
			save(lang);
			apply(lang);
		}
	};

	document.querySelectorAll('#lang-switch [data-lang]').forEach(function (b) {
		b.addEventListener('click', function () { I18N.set(b.getAttribute('data-lang')); });
	});

	apply(detect());
})();
