// ==UserScript==
// @name         YouTube Open Videos in New Tab
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Force YouTube video links to open in a new tab instead of current one.
// @author       Bob
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Wait for DOM to load
    window.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('click', function (e) {
            // Left click only, no modifier keys
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                return;
            }

            let el = e.target;

            // Climb up to <a> if needed
            while (el && el.tagName !== 'A') {
                el = el.parentElement;
            }

            // Only proceed if <a> tag has a valid YouTube watch link
            if (
                el &&
                el.tagName === 'A' &&
                el.href &&
                el.href.includes('watch') &&
                el.origin === location.origin
            ) {
                e.stopImmediatePropagation(); // Stop YouTube's router from hijacking
                e.preventDefault();           // Prevent normal behavior
                window.open(el.href, '_blank', 'noopener');
            }
        }, true); // Use capture phase to beat YouTube's handlers
    });
})();
