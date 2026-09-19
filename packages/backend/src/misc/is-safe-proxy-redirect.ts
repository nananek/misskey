/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * メディアプロキシ系のエンドポイント (/emoji, /proxy, ファイルサムネイル等) が
 * リダイレクトしようとしている URL が、想定した trusted origin
 * (自ホストの mediaProxy / videoThumbnailGenerator 等、サーバー設定由来のオリジン)
 * に収まっているかを検証する。
 *
 * これらのエンドポイントは originalUrl 等リモート/攻撃者が制御しうる値を
 * 扱うため、実装ミスでその値をリダイレクト先そのものとして直接使ってしまうと
 * オープンリダイレクトになる。ここでは最終防波堤として、実際に
 * reply.redirect() へ渡す直前の URL の origin を検証する。
 */
export function isSafeProxyRedirectUrl(url: string | URL, trustedOrigin: string): boolean {
	let parsed: URL;
	try {
		parsed = typeof url === 'string' ? new URL(url) : url;
	} catch {
		return false;
	}

	return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === trustedOrigin;
}
