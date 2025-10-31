// ==UserScript==
// @name         Grafana Login Accelerate (nonce aware JSON)
// @namespace    https://tampermonkey.net/
// @version      0.5.0
// @description  轻量登录页 + 自动携带 X-Grafana-Nonce
// @match        https://loki.grafana.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (location.pathname !== '/login') return;

    const pageUrl = location.href;
    let originalHtml = '';
    let csrfToken = null;

    async function acquireBootData() {
        // 1) 尝试从 /api/frontend/meta 获取 csrfToken
        try {
            const metaResp = await fetch('/api/frontend/meta', {
                cache: 'no-store',
                credentials: 'include',
            });
            if (metaResp.ok) {
                const meta = await metaResp.json().catch(() => null);
                if (meta && meta.csrfToken) {
                    csrfToken = meta.csrfToken;
                }
                if (!originalHtml && meta && meta.html) {
                    originalHtml = meta.html;
                }
            }
        } catch (err) {
            console.warn('[TM Grafana Login] 获取 frontend/meta 失败:', err);
        }

        // 2) 仍未拿到 token，则再请求一次原始登录页解析
        if (!csrfToken || !originalHtml) {
            try {
                const resp = await fetch(pageUrl, {
                    cache: 'no-store',
                    credentials: 'include',
                });
                if (resp.ok) {
                    const text = await resp.text();
                    originalHtml = text;
                    const match = text.match(/"csrfToken":"([^"]+)"/);
                    if (match) {
                        csrfToken = JSON.parse(`"${match[1]}"`);
                    }
                }
            } catch (err) {
                console.warn('[TM Grafana Login] 解析原始 login 页失败:', err);
            }
        }
    }

    const tmpl = String.raw;
    const shell = tmpl`<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
  <meta charset="utf-8">
  <title>Grafana 登录（轻量版）</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      background: radial-gradient(circle at 18% 22%, #203040, #0c1116 70%);
      color: #f5f7fa;
    }
    .card { width: min(360px, 92vw); padding: 32px 28px; border-radius: 18px; background: rgba(15,23,31,.88); backdrop-filter: blur(14px); box-shadow: 0 28px 60px
  rgba(0,0,0,.45); }
    h1 { margin: 0 0 26px; font-size: 22px; text-align: center; letter-spacing: .02em; }
    label { display: block; margin-bottom: 6px; font-size: 13px; opacity: .84; }
    input[type="text"], input[type="password"] {
      width: 100%; padding: 11px 12px; margin-bottom: 18px;
      border-radius: 9px; border: 1px solid rgba(128,142,160,.32);
      background: rgba(9,15,20,.86); color: inherit; font-size: 15px;
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    input[type="text"]:focus, input[type="password"]:focus { border-color: #53b7ff; box-shadow: 0 0 0 3px rgba(83,183,255,.28); outline: none; }
    .actions { display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 18px; }
    .actions a { color: #8fd4ff; text-decoration: none; }
    .actions a:hover { text-decoration: underline; }
    button[type="submit"] {
      width: 100%; padding: 12px 14px; border: none; border-radius: 10px;
      font-size: 15px; font-weight: 600;
      background: linear-gradient(135deg,#74dbff,#47acff);
      color: #0b1016; cursor: pointer;
      transition: transform .16s, box-shadow .16s;
    }
    button[type="submit"]:disabled { cursor: not-allowed; filter: grayscale(.4); opacity: .7; }
    button[type="submit"]:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(71,172,255,.35); }
    .status { min-height: 22px; margin-top: 14px; text-align: center; font-size: 13px; }
    .status.info { color: #8cd4ff; }
    .status.error { color: #ff8585; }
    .footer { margin-top: 28px; font-size: 12px; text-align: center; opacity: .72; }
    .footer button { background: none; border: none; padding: 0; color: #8cd4ff; text-decoration: underline; cursor: pointer; font: inherit; }
    .otp-field { display: none; }
    .otp-field.visible { display: block; }
  </style>
  </head>
  <body>
  <main class="card">
    <h1>Grafana 登录（轻量版）</h1>
    <form id="tm-login-form" autocomplete="on">
      <label for="tm-user">用户名 / 邮箱</label>
      <input id="tm-user" name="user" type="text" autocomplete="username" required>

      <label for="tm-password">密码</label>
      <input id="tm-password" name="password" type="password" autocomplete="current-password" required>

      <div id="tm-otp-wrapper" class="otp-field">
        <label for="tm-otp">一次性验证码 (若启用 2FA)</label>
        <input id="tm-otp" name="otp" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code">
      </div>

      <div class="actions">
        <label><input id="tm-remember" type="checkbox"> 记住用户名</label>
        <a href="https://loki.kava.work/user/password/send-reset-email" target="_blank" rel="noopener">忘记密码？</a>
      </div>

      <button id="tm-submit" type="submit">登录</button>
      <div id="tm-status" class="status" aria-live="polite"></div>
    </form>

    <div class="footer">
      登录异常时可
      <button type="button" id="tm-open-original">加载原始页面</button>
    </div>
  </main>
  <script>
  (function () {
    const params = new URLSearchParams(location.search);
    const redirectTo =
      params.get('redirect') ||
      sessionStorage.getItem('tm-grafana-last-path') ||
      (params.has('orgId') ? '/?orgId=' + params.get('orgId') : '/');

    const userInput = document.getElementById('tm-user');
    const pwdInput = document.getElementById('tm-password');
    const otpInput = document.getElementById('tm-otp');
    const rememberInput = document.getElementById('tm-remember');
    const submitBtn = document.getElementById('tm-submit');
    const statusEl = document.getElementById('tm-status');
    const otpWrapper = document.getElementById('tm-otp-wrapper');

    const savedUser = localStorage.getItem('tm-grafana-last-user');
    if (savedUser) {
      userInput.value = savedUser;
      rememberInput.checked = true;
      pwdInput.focus();
    } else {
      userInput.focus();
    }

    const showStatus = (msg, type) => {
      statusEl.textContent = msg || '';
      statusEl.className = 'status ' + (type || '');
    };

    const setDisabled = (disabled) => {
      [userInput, pwdInput, otpInput, rememberInput, submitBtn].forEach((el) => {
        if (el) el.disabled = disabled;
      });
    };

    async function login(payload) {
      await window.__tmReady;

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Grafana-Org-Id': '0',
      };
      if (window.__tmCsrfToken) {
        headers['X-Grafana-Nonce'] = window.__tmCsrfToken;
      }

      const body = {
        user: payload.user,
        password: payload.password,
        remember: Boolean(payload.remember),
      };
      if (payload.otp) {
        body.otp = payload.otp;
      }

      const resp = await fetch('/login', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });

      const contentType = resp.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await resp.json().catch(() => ({}));
      } else {
        const text = await resp.text().catch(() => '');
        data = { message: text };
      }

      if (!resp.ok) {
        const err = new Error(data.message || data.error || ('登录失败 (' + resp.status + ')'));
        err.code = resp.status;
        err.messageId = data.messageId || '';
        throw err;
      }

      return data;
    }

    function loadOriginalPage() {
      if (window.__tmOriginalHTML) {
        document.open();
        document.write(window.__tmOriginalHTML);
        document.close();
      } else {
        location.reload();
      }
    }

    document.getElementById('tm-open-original').addEventListener('click', () => loadOriginalPage());

    document.getElementById('tm-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const user = userInput.value.trim();
      const password = pwdInput.value;
      const otp = otpInput.value.trim();

      if (!user || !password) {
        showStatus('请输入用户名和密码', 'error');
        return;
      }

      showStatus(window.__tmCsrfToken ? '正在登录...' : '未拿到 CSRF，尝试登录中...', window.__tmCsrfToken ? 'info' : 'error');
      setDisabled(true);

      try {
        await login({
          user,
          password,
          otp,
          remember: rememberInput.checked,
        });

        if (rememberInput.checked) {
          localStorage.setItem('tm-grafana-last-user', user);
        } else {
          localStorage.removeItem('tm-grafana-last-user');
        }

        sessionStorage.setItem('tm-grafana-last-path', redirectTo);
        showStatus('登录成功，正在跳转...', 'info');
        setTimeout(() => location.assign(redirectTo || '/'), 160);
      } catch (err) {
        console.error('[TM Grafana Login] 登录失败', err);
        setDisabled(false);
        pwdInput.focus();

        const msg = (err.message || '').toLowerCase();
        if (err.messageId === 'password-auth.totp-required') {
          showStatus('需要输入一次性验证码', 'error');
          otpWrapper.classList.add('visible');
        } else if (err.messageId === 'password-auth.failed') {
          showStatus('用户名或密码不正确', 'error');
        } else if (/bad login data/i.test(err.message || '')) {
          showStatus('服务器拒绝请求，正在恢复原始页面...', 'error');
          setTimeout(loadOriginalPage, 300);
          return;
        } else if (err.code === 401) {
          showStatus(err.message || '认证失败 (401)', 'error');
        } else {
          showStatus(err.message || '登录失败', 'error');
        }

        if (!window.__tmCsrfToken) {
          showStatus('未拿到 CSRF token，建议点击下方“加载原始页面”重试。', 'error');
        }
      }
    });
  })();
  </script>
  </body>
  </html>`;

    document.open();
    document.write(shell);
    document.close();

    window.__tmReady = (async () => {
        await acquireBootData();
        window.__tmOriginalHTML = originalHtml;
        window.__tmCsrfToken = csrfToken;
    })();
})();

