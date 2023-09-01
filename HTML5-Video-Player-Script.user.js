// ==UserScript==
// @name         HTML5 Video Player Script
// @namespace    http://tampermonkey.net/
// @version      0.1
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
    speedDisplay.style.position = 'absolute';
    speedDisplay.style.zIndex = '9999';
    speedDisplay.style.top = '10px';
    speedDisplay.style.left = '10px';
    speedDisplay.style.background = 'black';
    speedDisplay.style.color = 'white';
    speedDisplay.style.fontSize = '14px';
    speedDisplay.style.padding = '5px';
    speedDisplay.style.display = 'none';
    document.body.appendChild(speedDisplay);

    // Wait for video player to load
    const waitForPlayer = setInterval(() => {
        const player = document.querySelector('video');
        if (player) {
            clearInterval(waitForPlayer);
            player.playbackRate = playbackRate;
            updateSpeedDisplay(playbackRate);

            // Add event listener for keydown event
            document.addEventListener('keydown', handleKeyDown);
            // Add event listener for ratechange event
            player.addEventListener('ratechange', handleRateChange);
        }
    }, 1000);

    // Handle keydown event
    function handleKeyDown(event) {
        // Check if the active element is an input element
        if (document.activeElement.id.toLowerCase() === 'contenteditable-root') {
            return; // If typing in an input element, don't handle keydown for playback control
        }

        const player = document.querySelector('video');
        if (event.code.toLowerCase() === 'minus' || event.code.toLowerCase() === 'keyz') {
            playbackRate -= 0.5;
            if (playbackRate < 0.5) {
                playbackRate = 0.5;
            }
            player.playbackRate = playbackRate;
            updateSpeedDisplay(playbackRate);
        }
        else if (event.code.toLowerCase() === 'equal' || event.code.toLowerCase() === 'keyx') {
            playbackRate += 0.5;
            if (playbackRate > 16) {
                playbackRate = 16;
            }
            player.playbackRate = playbackRate;
            updateSpeedDisplay(playbackRate);
        }
        else if (event.code.toLowerCase() === 'keya') {
            player.currentTime -= 30;
            updateForwardAndRewindDisplay(-30)
        }
        else if (event.code.toLowerCase() === 'keys') {
            player.currentTime += 30;
            updateForwardAndRewindDisplay(30)
        }
        else if (event.shiftKey && event.code.toLowerCase() === 'arrowleft') {
            player.currentTime -= 30;
            updateForwardAndRewindDisplay(-30)
        }
        else if (event.shiftKey && event.code.toLowerCase() === 'arrowright') {
            player.currentTime += 30;
            updateForwardAndRewindDisplay(30)
        }
    }

    // Handle ratechange event
    function handleRateChange(event) {
        const player = event.target;
        playbackRate = player.playbackRate;
        updateSpeedDisplay(playbackRate);
    }

    // Update speed display
    function updateSpeedDisplay(playbackRate) {
        speedDisplay.innerHTML = `Speed: ${playbackRate.toFixed(1)}x`;
        speedDisplay.style.display = 'block';
        setTimeout(() => {
            speedDisplay.style.display = 'none';
        }, 3000);
    }

    // Update speed display
    function updateForwardAndRewindDisplay(num) {
        speedDisplay.innerHTML = `forward & rewind: ${num.toFixed(1)}x`;
        speedDisplay.style.display = 'block';
        setTimeout(() => {
            speedDisplay.style.display = 'none';
        }, 3000);
    }
})();
