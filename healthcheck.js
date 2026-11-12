// SPDX-FileCopyrightText: syuilo and misskey-project
// SPDX-License-Identifier: AGPL-3.0-only
//
// Docker distroless 環境用のヘルスチェックスクリプト。
// healthcheck.sh (bash + awk + curl) の代替として Node.js のみで動作する。
// TCP ポート / UNIX ドメインソケット (config.socket) の両方に対応する。
'use strict';
const { request } = require('node:http');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// config.ts と同じ規則で設定ファイルを決める (distroless には YAML パーサが無いので簡易に読む)
const CONFIG_DIR = '/misskey/.config';
const cfgFile = process.env.MISSKEY_CONFIG_YML
	? resolve(CONFIG_DIR, process.env.MISSKEY_CONFIG_YML)
	: resolve(CONFIG_DIR, process.env.NODE_ENV === 'test' ? 'test.yml' : 'default.yml');

/** YAML のトップレベルのスカラー値を取り出す */
function scalar(text, key) {
	const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
	if (!m) return undefined;
	let v = m[1].trim();
	if (v.startsWith('"') || v.startsWith("'")) {
		const q = v[0];
		const end = v.indexOf(q, 1);
		v = end === -1 ? v.slice(1) : v.slice(1, end);
	} else {
		const hash = v.indexOf(' #');
		if (hash !== -1) v = v.slice(0, hash);
		v = v.trim();
	}
	return v === '' || v === '~' || v === 'null' ? undefined : v;
}

let yml = '';
try {
	yml = readFileSync(cfgFile, 'utf-8');
} catch {}

const socket = scalar(yml, 'socket');
const cfgPort = parseInt(scalar(yml, 'port') ?? '', 10);

const opts = { path: '/healthz', method: 'GET', timeout: 5000 };

if (typeof socket === 'string' && socket.length > 0) {
	opts.socketPath = socket;
} else {
	opts.hostname = '127.0.0.1';
	opts.port = (Number.isInteger(cfgPort) && cfgPort > 0 ? cfgPort : 0)
		|| parseInt(process.env.PORT ?? '', 10)
		|| 3000;
}

const req = request(opts, (res) => {
	res.resume();
	process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
req.end();
