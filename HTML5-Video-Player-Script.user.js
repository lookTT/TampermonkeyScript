// ==UserScript==
// @name         HTML5 Video Player Script
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Set default video playback speed to 2x on YouTube and bilibili, display speed in player, fix bugs
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
    speedDisplay.style.display = 'block';
    speedDisplay.style.pointerEvents = 'none'; // 防止影响用户点击
    document.body.appendChild(speedDisplay);

    function updateSpeedDisplay() {
        speedDisplay.textContent = `Speed: ${playbackRate.toFixed(1)}x`;
    }

    // 等待视频加载
    const init = setInterval(() => {
        const player = document.querySelector('video');
        if (player) {
            clearInterval(init);
            player.playbackRate = playbackRate;
            updateSpeedDisplay();

            // 监听按键事件
            document.addEventListener('keydown', handleKeyDown);

            // 监听播放速率变化事件
            player.addEventListener('ratechange', () => {
                playbackRate = player.playbackRate;
                updateSpeedDisplay();
            });
        }
    }, 1000);

    function handleKeyDown(event) {
        if (document.activeElement.tagName.toLowerCase() === 'input' ||
            document.activeElement.tagName.toLowerCase() === 'textarea' ||
            document.activeElement.isContentEditable) {
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
