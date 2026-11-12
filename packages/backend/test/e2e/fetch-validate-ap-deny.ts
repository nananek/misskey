/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import { describe, test, expect } from 'vitest';
import { validateContentTypeSetAsActivityPub, validateContentTypeSetAsJsonLD } from '@/core/activitypub/misc/validator.js';
import { relativeFetch } from '../utils.js';

// この fork はドライブのファイルを本体から直接配信しない (内部向けにリダイレクトする) ため、
// アップロードしたファイルの URL は content-type を持たない。content-type が確実に付く
// 非 AP リソースとして、同梱の代打画像を使う。
const nonApResource = '/files/app-default.jpg';

describe('validateContentTypeSetAsActivityPub/JsonLD (deny case)', () => {
	test('ActivityStreams: ファイルはエラーになる', async () => {
		const res = await relativeFetch(nonApResource);

		function doValidate() {
			validateContentTypeSetAsActivityPub(res);
		}

		expect(doValidate).toThrow('Content type is not');
	});

	test('JSON-LD: ファイルはエラーになる', async () => {
		const res = await relativeFetch(nonApResource);

		function doValidate() {
			validateContentTypeSetAsJsonLD(res);
		}

		expect(doValidate).toThrow('Content type is not');
	});
});
