// ==UserScript==
// @name         HTML5 Video Player Script
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Set default video playback speed to 2x on YouTube and Bilibili, display speed in player, fix bugs
// @author       zltdhr
// @match        https://*.youtube.com/watch*
// @match        https://*.bilibili.com/*
// @match        https://*.qq.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let playbackRate = 2;
    const speedDisplay = document.createElement('div');
    speedDisplay.id = 'custom-speed-display';
    speedDisplay.style.position = 'fixed';
    speedDisplay.style.zIndex = '10000';
    speedDisplay.style.top = '20px';
    speedDisplay.style.left = '20px';
    speedDisplay.style.background = 'rgba(0, 0, 0, 0.7)';
    speedDisplay.style.color = 'white';
    speedDisplay.style.fontSize = '16px';
    speedDisplay.style.padding = '8px 12px';
    speedDisplay.style.borderRadius = '5px';
    speedDisplay.style.display = 'none'; // Initially hidden
    speedDisplay.style.pointerEvents = 'none'; // Prevent interfering with user interaction
    document.body.appendChild(speedDisplay);

    let hideTimeout;

    function updateSpeedDisplay() {
        speedDisplay.textContent = `Speed: ${playbackRate.toFixed(1)}x`;
        speedDisplay.style.display = 'block'; // Show the speed display

        // Clear existing timeout if present
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }

        // Auto-hide after 2 seconds
        hideTimeout = setTimeout(() => {
            speedDisplay.style.display = 'none';
        }, 2000);
    }

    // Wait for the video element to be available
    const init = setInterval(() => {
        const player = document.querySelector('video');
        if (player) {
            clearInterval(init);
            player.playbackRate = playbackRate;
            updateSpeedDisplay();

            // Listen for keyboard events
            document.addEventListener('keydown', handleKeyDown);

            // Listen for playback speed changes
            player.addEventListener('ratechange', () => {
                playbackRate = player.playbackRate;
                updateSpeedDisplay();
            });
        }
    }, 1000);

    function handleKeyDown(event) {
        if (
            document.activeElement.tagName.toLowerCase() === 'input' ||
            document.activeElement.tagName.toLowerCase() === 'textarea' ||
            document.activeElement.isContentEditable
        ) {
            return;
        }

        const player = document.querySelector('video');
        if (!player) return;

        if (event.code.toLowerCase() === 'keyz') {
            playbackRate = Math.max(0.5, playbackRate - 0.5);
            player.playbackRate = playbackRate;
        } else if (event.code.toLowerCase() === 'keyx') {
            playbackRate = Math.min(16, playbackRate + 0.5);
            player.playbackRate = playbackRate;
        } else if (event.code.toLowerCase() === 'keya' || (event.shiftKey && event.code.toLowerCase() === 'arrowleft')) {
            player.currentTime -= 30;
        } else if (event.code.toLowerCase() === 'keys' || (event.shiftKey && event.code.toLowerCase() === 'arrowright')) {
            player.currentTime += 30;
        }
        updateSpeedDisplay();
    }
})();
