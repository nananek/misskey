// SPDX-FileCopyrightText: syuilo and misskey-project
// SPDX-License-Identifier: AGPL-3.0-only
//
// Docker distroless 環境用のヘルスチェックスクリプト。
// healthcheck.sh (bash + awk + curl) の代替として Node.js のみで動作する。
'use strict';
const { request } = require('node:http');
const { readFileSync } = require('node:fs');

let port = parseInt(process.env.PORT ?? '', 10) || 3000;
try {
	const cfg = JSON.parse(readFileSync('/misskey/built/.config.json', 'utf-8'));
	if (typeof cfg.port === 'number') port = cfg.port;
} catch {}

const req = request(
	{ hostname: '127.0.0.1', port, path: '/healthz', method: 'GET', timeout: 5000 },
	(res) => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); },
);
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
req.end();
