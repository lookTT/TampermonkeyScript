// ==UserScript==
// @name         Yearning 登录页视频屏蔽
// @namespace    https://db.yearning.com/
// @version      0.1
// @description  阻止 Yearning 登录页背景视频加载，提升首屏响应速度
// @match        https://db.yearning.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const BLOCK_PATTERNS = [/front\/assets\/1\.77f7bbc4\.mp4/i];

    const { set: nativeSrcSetter, get: nativeSrcGetter } =
        Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');

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

    // 拦截属性写入
    const nativeSetAttribute = Element.prototype.setAttribute;
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

    // 拦截 media.src 赋值
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

    // 拦截 load()
    const nativeLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () {
        if (shouldBlock(this.currentSrc || nativeSrcGetter.call(this))) {
            disableVideo(this);
            return;
        }
        return nativeLoad.apply(this, arguments);
    };

    function purge() {
        document.querySelectorAll('video, source').forEach(node => {
            const src = node.src || node.getAttribute('src') || '';
            if (shouldBlock(src)) {
                if (node.tagName === 'VIDEO') {
                    disableVideo(node);
                } else {
                    node.remove();
                }
            }
        });
    }

    const observer = new MutationObserver(purge);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState !== 'loading') {
        purge();
    } else {
        document.addEventListener('DOMContentLoaded', purge);
    }

    const style = document.createElement('style');
    style.textContent = `
          video.tm-video-blocked {
              background: #0d1a26;
              width: 100%;
              height: 100%;
              object-fit: cover;
          }
      `;
    document.documentElement.appendChild(style);
})();
