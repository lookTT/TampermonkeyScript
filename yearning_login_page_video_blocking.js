
// ==UserScript==
// @name         Yearning 登录页提速增强
// @namespace    https://db.yearning.com/
// @version      0.3
// @description  屏蔽 Yearning 登录页背景视频，并加速登录及常用模块加载
// @match        https://db.yearning.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const ASSET_BASE = new URL('/front/assets/', location.origin);
    let manifestPromise = null;
    let manifestCache = null;
    const prefetchedGroups = new Set();

    function getManifest() {
        if (manifestCache) return Promise.resolve(manifestCache);
        if (manifestPromise) return manifestPromise;
        const indexUrl = new URL('index.cc1dcda1.js', ASSET_BASE).href;
        manifestPromise = fetch(indexUrl, { cache: 'force-cache' })
            .then(resp => resp.text())
            .then(text => {
                const chunkMap = new Map();
                const regex = /import\("\.\/([^"]+)"\),\[(.*?)\]\)/gs;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const chunk = match[1];
                    const arrayText = `[${match[2]}]`;
                    try {
                        const assets = JSON.parse(arrayText);
                        chunkMap.set(chunk, assets);
                    } catch (err) {
                        console.debug('tm-parse manifest failed', chunk, err);
                    }
                }
                manifestCache = { text, chunkMap };
                return manifestCache;
            })
            .catch(err => {
                manifestPromise = null;
                throw err;
            });
        return manifestPromise;
    }

    function injectPrefetch(url) {
        if (!url || document.querySelector(`link[data-tm-prefetch="${url}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        if (url.endsWith('.css')) link.as = 'style';
        else if (url.endsWith('.js')) link.as = 'script';
        else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(url)) link.as = 'image';
        link.crossOrigin = 'anonymous';
        link.dataset.tmPrefetch = url;
        (document.head || document.documentElement).appendChild(link);
        if (win.fetch) win.fetch(url, { cache: 'force-cache' }).catch(() => { });
    }

    function injectAsset(rel) {
        if (!rel) return;
        let url = rel;
        if (!/^https?:/i.test(rel)) {
            const normalized = rel.startsWith('assets/') ? rel.slice(7) : rel;
            url = new URL(normalized, ASSET_BASE).href;
        }
        injectPrefetch(url);
    }

    async function prefetchGroup(id, chunkHints = [], extras = []) {
        if (prefetchedGroups.has(id)) return;
        prefetchedGroups.add(id);
        try {
            const { chunkMap } = await getManifest();
            const assetSet = new Set();
            if (chunkHints.length) {
                chunkMap.forEach((assets, chunk) => {
                    if (chunkHints.some(hint => chunk.includes(hint))) {
                        assets.forEach(item => assetSet.add(item));
                    }
                });
            }
            extras.forEach(item => assetSet.add(item));
            assetSet.forEach(rel => injectAsset(rel));
        } catch (err) {
            console.debug('tm-prefetch', id, err);
        }
    }

    function queueIdle(fn, delay = 0, timeout = 2000) {
        const run = () => {
            if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(fn, { timeout });
            else win.setTimeout(fn, 0);
        };
        if (delay > 0) win.setTimeout(run, delay);
        else run();
    }

    const HOME_HINTS = ['home.', 'layout.', 'subLayout.'];
    const AUDIT_HINTS = ['list.', 'orderTable.', 'pageHeader.', 'editor.', 'record.', 'fetch.', 'source.'];

    function scheduleRoutePrefetch() {
        if (location.hash.includes('/login')) {
            queueIdle(() => prefetchGroup('home-entry', HOME_HINTS), 0, 2000);
        }
        if (location.hash.includes('/home')) {
            queueIdle(() => prefetchGroup('audit-order', AUDIT_HINTS), 1500, 3000);
        }
    }

    function setupMenuPrefetchObserver() {
        const processed = new WeakSet();
        const trigger = () => prefetchGroup('audit-order', AUDIT_HINTS);
        const attach = node => {
            if (!(node instanceof HTMLElement) || processed.has(node)) return;
            const role = node.getAttribute && node.getAttribute('role');
            const text = (node.textContent || '').trim();
            if (role === 'menuitem' && text && (text.includes('工单') || text.includes('审核'))) {
                const once = () => trigger();
                node.addEventListener('pointerenter', once, { once: true, passive: true });
                node.addEventListener('focus', once, { once: true, passive: true });
                node.addEventListener('touchstart', once, { once: true, passive: true });
                processed.add(node);
            }
        };
        document.querySelectorAll('[role="menuitem"]').forEach(attach);
        const observer = new MutationObserver(records => {
            records.forEach(record => {
                record.addedNodes.forEach(node => {
                    if (node instanceof HTMLElement) {
                        attach(node);
                        node.querySelectorAll && node.querySelectorAll('[role="menuitem"]').forEach(attach);
                    }
                });
            });
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }

    /* 背景视频拦截（保持不变） */
    const BLOCK_PATTERNS = [/front\/assets\/1\.77f7bbc4\.mp4/i];
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    const nativeSrcSetter = srcDescriptor.set;
    const nativeSrcGetter = srcDescriptor.get;
    const nativeSetAttribute = Element.prototype.setAttribute;
    const nativeLoad = HTMLMediaElement.prototype.load;

    function shouldBlock(url) {
        if (!url) return false;
        try {
            const normalized = new URL(url, location.href).href;
            return BLOCK_PATTERNS.some(re => re.test(normalized));
        } catch (e) {
            return false;
        }
    }

    function disableVideo(el) {
        if (!el || el.dataset.tmVideoBlocked === '1') return;
        el.pause?.();
        el.dataset.tmVideoBlocked = '1';
        el.removeAttribute('src');
        while (el.firstChild) el.removeChild(el.firstChild);
        el.classList.add('tm-video-blocked');
    }

    Element.prototype.setAttribute = function (name, value) {
        if ((this.tagName === 'VIDEO' || this.tagName === 'SOURCE') &&
            (name === 'src' || name === 'data-src') &&
            shouldBlock(value)) {
            value = '';
            if (this.tagName === 'VIDEO') disableVideo(this);
            return nativeSetAttribute.call(this, name, value);
        }
        return nativeSetAttribute.call(this, name, value);
    };

    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        configurable: true,
        enumerable: true,
        get: nativeSrcGetter,
        set(value) {
            if (shouldBlock(value)) {
                disableVideo(this);
                return nativeSrcSetter.call(this, '');
            }
            return nativeSrcSetter.call(this, value);
        }
    });

    HTMLMediaElement.prototype.load = function () {
        if (shouldBlock(this.currentSrc || nativeSrcGetter.call(this))) {
            disableVideo(this);
            return;
        }
        return nativeLoad.apply(this, arguments);
    };

    function purgeVideos() {
        document.querySelectorAll('video, source').forEach(node => {
            const src = node.src || node.getAttribute('src') || '';
            if (!shouldBlock(src)) return;
            if (node.tagName === 'VIDEO') disableVideo(node);
            else node.remove();
        });
    }

    const videoObserver = new MutationObserver(purgeVideos);
    videoObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState !== 'loading') purgeVideos();
    else document.addEventListener('DOMContentLoaded', purgeVideos);

    const style = document.createElement('style');
    style.textContent = 'video.tm-video-blocked{background:#0d1a26;width:100%;height:100%;object-fit:cover;}';
    document.documentElement.appendChild(style);

    /* 登录去抖补丁 */
    (function accelerateLoginDebounce() {
        const original = win.setTimeout;
        if (original.__tmLoginPatched) return;
        const pattern = /(USER_STORE|CHANGE_SELECTED|\/home"|\/home')/;
        function patched(callback, delay, ...args) {
            if (typeof callback === 'function' &&
                delay === 200 &&
                location.hash.includes('/login') &&
                pattern.test(String(callback))) {
                return original.call(this, callback, 0, ...args);
            }
            return original.call(this, callback, delay, ...args);
        }
        patched.__tmLoginPatched = true;
        original.__tmLoginPatched = true;
        win.setTimeout = patched;
    })();

    /* 预取调度 */
    scheduleRoutePrefetch();
    win.addEventListener('hashchange', scheduleRoutePrefetch, { passive: true });

    if (document.readyState !== 'loading') setupMenuPrefetchObserver();
    else document.addEventListener('DOMContentLoaded', setupMenuPrefetchObserver);
})();