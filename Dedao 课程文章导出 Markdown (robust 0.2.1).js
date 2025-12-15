// ==UserScript==
// @name         Dedao 课程文章导出 Markdown (robust 0.2.1)
// @namespace    https://dedao.cn/
// @version      0.2.1
// @description  在得到课程文章页一键导出正文为 Markdown
// @match        https://www.dedao.cn/course/article*
// @grant        GM_download
// @run-at       document-end
// ==/UserScript==

(function () {
    const BTN_ID = 'dedao-export-md-btn';
    const selectors = [
        '[data-testid="article-body"]',
        '[class*="article"][class*="content"]',
        '[class*="article-body"]',
        '[class*="ArticleContent"]',
        'article',
    ];
    const log = (...a) => console.log('[dedao-md]', ...a);
    const toast = (msg) => {
        let t = document.getElementById('dedao-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'dedao-toast';
            Object.assign(t.style, {
                position: 'fixed',
                right: '20px',
                bottom: '60px',
                zIndex: 99999,
                background: '#333',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                fontSize: '13px',
            });
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = 1;
        setTimeout(() => (t.style.opacity = 0), 2000);
    };

    const waitForContainer = (timeout = 8000) =>
        new Promise((resolve) => {
            const found = findContainer();
            if (found) return resolve(found);
            const obs = new MutationObserver(() => {
                const c = findContainer();
                if (c) {
                    obs.disconnect();
                    resolve(c);
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                obs.disconnect();
                resolve(findContainer() || fallbackContainer() || document.body);
            }, timeout);
        });

    function findContainer() {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function fallbackContainer() {
        const titleEl =
            document.querySelector('.article-title.iget-common-c1') ||
            document.querySelector('h1');
        if (!titleEl) return null;
        const ancestor = titleEl.closest('main,section,article,div');
        return ancestor || null;
    }

    function text(sel) {
        const el = document.querySelector(sel);
        return el ? el.innerText.trim() : '';
    }

    function meta() {
        const getTitle = () => {
            const byClass = document.querySelector('.article-title.iget-common-c1');
            if (byClass) return byClass.textContent.trim();
            const h1 = document.querySelector('h1');
            if (h1) return h1.innerText.trim();
            const byTitle = document.querySelector('[class*="title"]');
            if (byTitle) return byTitle.innerText.trim();
            return document.title.replace(/ - 得到APP.*/, '');
        };

        const title = getTitle();
        return {
            title: title || 'dedao-article',
            course: text('[class*="course"]') || text('[class*="subtitle"]'),
            publish: text('[class*="time"]') || text('[class*="date"]') || text('time'),
            duration: text('[class*="duration"]') || text('[class*="clock"]'),
            narrator: text('[class*="reader"]') || text('[class*="transmit"]'),
        };
    }


    const abs = (u) => {
        try {
            return new URL(u, location.href).href;
        } catch {
            return u;
        }
    };

    function convertInline(html) {
        if (!html) return '';
        let out = html;
        // bold tags -> markdown bold
        out = out.replace(/<(b|strong)>(.*?)<\/\1>/gis, '**$2**');
        // font color 或 style 含 color -> 以加粗替代颜色提示
        out = out.replace(/<font[^>]*color=["']?([^"'>]+)["']?[^>]*>(.*?)<\/font>/gis, '**$2**');
        out = out.replace(
            /<(font|span)[^>]*style=["'][^"']*color\s*:\s*([^;"'>]+)[^"']*["'][^>]*>(.*?)<\/\1>/gis,
            '**$3**'
        );
        out = out.replace(/\*{3,}([^*]+)\*{3,}/g, '**$1**');
        // <br> -> 换行
        out = out.replace(/<br\s*\/?>/gi, '\n');
        // 去掉标签
        out = out.replace(/<(?!span\b)[^>]+>/gi, '');
        // 去掉残余 span
        out = out.replace(/<\/?span[^>]*>/gi, '');
        return out.trim();
    }

    function nodeToMd(node) {
        if (!node) return '';
        const tag = (node.tagName || '').toLowerCase();
        const txt = (node.innerText || '').trim();
        const html = node.innerHTML;

        // "划重点" 模块：标题 + 列表（保持换行）
        if (node.classList && node.classList.contains('elite-module')) {
            const contentEl = node.querySelector('.content');
            const raw = contentEl ? contentEl.innerHTML || contentEl.innerText : html || txt;
            const text = convertInline(raw || '')
                .split(/\n+/)
                .map((l) => l.trim())
                .filter(Boolean)
                .join('\n');
            return `## 划重点\n\n${text}`;
        }

        // 仅图片的 figure 或纯图片节点也要保留
        const imgs = Array.from(node.querySelectorAll ? node.querySelectorAll('img') : []);
        if (!txt && !imgs.length) return '';

        // 跳过音频播放器相关节点
        if (
            node.classList &&
            Array.from(node.classList).some((c) =>
                /(audio|icon-play|audio-title|audio-duration)/i.test(c)
            )
        ) {
            return '';
        }
        if (
            node.closest &&
            node.closest('[class*="audio-player"],[class*="audio-title"],[class*="audio-duration"],[class*="icon-play"]')
        ) {
            return '';
        }

        // 自定义头部块：class 包含 article-header header-X
        if (node.classList && node.classList.contains('article-header')) {
            const headerClass = Array.from(node.classList).find((c) => c.startsWith('header-'));
            const level = headerClass ? parseInt(headerClass.replace('header-', ''), 10) || 2 : 2;
            return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${txt}`;
        }

        if (tag.match(/^h[1-6]$/)) return `${'#'.repeat(+tag[1])} ${txt}`;
        if (tag === 'blockquote')
            return convertInline(html || txt)
                .split('\n')
                .map((l) => `> ${l.trim()}`)
                .join('\n');
        if (tag === 'figure' && imgs.length) {
            return imgs
                .map((img) => `![${img.alt || ''}](${abs(img.src)})`)
                .join('\n');
        }
        if (tag === 'pre' || tag === 'code') return '```\n' + txt + '\n```';
        const img = node.querySelector('img');
        if (img && img.src) return `![${img.alt || ''}](${abs(img.src)})`;
        if (tag === 'li') return `- ${txt}`;
        // 默认块，保留行内样式/加粗
        return convertInline(html || txt);
    }

    function collectMd(container) {
        const seen = new Set();
        const lines = [];
        const blocks = Array.from(
            container.querySelectorAll(
                'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figure,[data-module-type="custom"],[class*="article-header"]'
            )
        );
        for (const n of blocks) {
            if (seen.has(n)) continue;
            // 跳过导航/侧边/底部等容器，但允许 message/comment 列表用于保留用户留言
            if (
                n.closest &&
                n.closest('[class*="nav"],[class*="sidebar"],[class*="footer"],[class*="tabs"],[class*="tag-list"],[class*="hashtag"],[class*="topic-wrap"]') &&
                !n.closest('[class*="message-list"]') &&
                !(n.tagName && n.tagName.toLowerCase() === 'figure') &&
                !n.querySelector('img')
            ) {
                continue;
            }
            // 跳过我的留言输入区/话题选择/搜索面板等交互区域
            if (
                n.closest &&
                n.closest(
                    '.my-comment,[class*="note-input-area"],[class*="editor-dialog"],[class*="add-topic"],[class*="search-control"],[class*="search-result"],[class*="toolbar"]'
                )
            ) {
                continue;
            }
            // 主体只保留正文，不在留言列表中的节点
            if (n.closest && n.closest('.message-list')) {
                continue;
            }
            // 跳过“用户留言”标题及过滤选项
            const tag = (n.tagName || '').toLowerCase();
            const textContent = (n.innerText || '').trim();
            if (tag.match(/^h[1-6]$/) && /用户留言/.test(textContent)) continue;
            if (tag === 'li' && ['综合排序', '最新发布', '只看作者回复'].includes(textContent)) continue;
            seen.add(n);
            const md = nodeToMd(n);
            if (md) lines.push(md);
        }

        // 单独提取留言区
        const messageList = document.querySelector('.message-list');
        if (messageList) {
            const items = Array.from(messageList.querySelectorAll('.note-item-wrapper'));
            if (items.length) {
                lines.push('## 用户留言');
                items.forEach((item) => {
                    const name =
                        item.querySelector('.name')?.innerText.trim() ||
                        item.querySelector('.author-info')?.innerText.trim() ||
                        '';
                    const date = item.querySelector('.date')?.innerText.trim() || '';
                    const text = item.querySelector('.note-text #text')?.innerHTML || '';
                    const reply = item.querySelector('.message-reply-content')?.innerText.trim();
                    const body = convertInline(text);
                    const parts = [];
                    if (name || date) parts.push(`- **${name || '用户'}** ${date}`.trim());
                    if (body) parts.push(body);
                    if (reply) parts.push(`> 作者回复：${reply}`);
                    if (parts.length) lines.push(parts.join('\n'));
                });
            }
        }
        return lines.join('\n\n');
    }

    function sanitize(name) {
        return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'dedao-article';
    }

    function build(meta, body) {
        const header = [
            `# ${meta.title}`,
            // meta.course ? `**课程**：${meta.course}` : '',
            // meta.publish ? `**发布时间**：${meta.publish}` : '',
            // meta.duration ? `**时长**：${meta.duration}` : '',
            // meta.narrator ? `**朗读/转述**：${meta.narrator}` : '',
            // `**URL**：${location.href}`,
            '',
        ]
            .filter(Boolean)
            .join('\n');
        return `${header}\n${body}`;
    }

    function download(filename, content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const ts = () => new Date().toISOString();

        const anchorDownload = (label) => {
            console.log('[dedao-md]', ts(), 'anchor download', label, filename);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast('已触发浏览器下载');
        };

        if (typeof GM_download === 'function') {
            console.log('[dedao-md]', ts(), 'GM_download start', filename);
            let finished = false;
            GM_download({
                name: filename,
                url: blobUrl,
                saveAs: false,
                onload: () => {
                    finished = true;
                    console.log('[dedao-md]', ts(), 'GM_download load (done)');
                    toast('已触发下载（GM_download）');
                },
                onerror: (e) => {
                    console.error('[dedao-md]', ts(), 'GM_download error', e);
                    if (!finished) anchorDownload('fallback after GM_error');
                },
                ontimeout: () => {
                    console.warn('[dedao-md]', ts(), 'GM_download timeout');
                    if (!finished) anchorDownload('fallback after GM_timeout');
                },
            });
            return;
        }

        anchorDownload('no GM_download');
    }

    function injectButton() {
        if (document.getElementById(BTN_ID)) return;
        const btn = document.createElement('button');
        btn.id = BTN_ID;
        btn.textContent = '导出 Markdown';
        Object.assign(btn.style, {
            position: 'fixed',
            right: '20px',
            bottom: '20px',
            zIndex: 99999,
            padding: '10px 14px',
            background: '#ff4d4f',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontSize: '14px',
        });
        btn.onclick = async () => {
            try {
                btn.textContent = '提取中...';
                btn.disabled = true;
                const container = await waitForContainer();
                if (!container) {
                    toast('未找到正文容器');
                    log('container not found');
                    return;
                }
                const m = meta();
                const body = collectMd(container);
                if (!body.trim()) {
                    toast('正文为空，可能容器选择不匹配');
                    log('body empty');
                    return;
                }
                const md = build(m, body);
                const fname = sanitize(m.title) + '.md';
                download(fname, md);
            } catch (e) {
                toast('导出失败，见控制台');
                log(e);
            } finally {
                btn.textContent = '导出 Markdown';
                btn.disabled = false;
            }
        };
        document.body.appendChild(btn);
    }

    injectButton();
})();
