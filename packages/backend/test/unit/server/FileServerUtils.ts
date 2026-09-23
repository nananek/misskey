/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { createRangeStream, parseRangeHeader } from '@/server/file/FileServerUtils.js';

describe('parseRangeHeader', () => {
	const size = 100;

	test('閉じた範囲を解釈できる', () => {
		expect(parseRangeHeader('bytes=0-1', size)).toEqual({ start: 0, end: 1 });
		expect(parseRangeHeader('bytes=10-20', size)).toEqual({ start: 10, end: 20 });
		expect(parseRangeHeader('bytes=99-99', size)).toEqual({ start: 99, end: 99 });
	});

	test('終端を省略した範囲を解釈できる', () => {
		expect(parseRangeHeader('bytes=5-', size)).toEqual({ start: 5, end: 99 });
		expect(parseRangeHeader('bytes=0-', size)).toEqual({ start: 0, end: 99 });
	});

	test('終端がサイズを超える場合はサイズ末尾に丸める', () => {
		expect(parseRangeHeader('bytes=0-200', size)).toEqual({ start: 0, end: 99 });
		expect(parseRangeHeader('bytes=50-1000', size)).toEqual({ start: 50, end: 99 });
	});

	test('末尾からのバイト数指定を解釈できる', () => {
		expect(parseRangeHeader('bytes=-5', size)).toEqual({ start: 95, end: 99 });
		expect(parseRangeHeader('bytes=-200', size)).toEqual({ start: 0, end: 99 });
	});

	test('不正または範囲外の指定は null を返す', () => {
		expect(parseRangeHeader('bytes=abc', size)).toBeNull();
		expect(parseRangeHeader('bytes=', size)).toBeNull();
		expect(parseRangeHeader('bytes=-', size)).toBeNull();
		expect(parseRangeHeader('bytes=--', size)).toBeNull();
		expect(parseRangeHeader('bytes=-0', size)).toBeNull();
		expect(parseRangeHeader('bytes=5-2', size)).toBeNull();
		expect(parseRangeHeader('bytes=100-', size)).toBeNull();
		expect(parseRangeHeader('bytes=200-300', size)).toBeNull();
		expect(parseRangeHeader('bytes=0-1,2-3', size)).toBeNull();
		expect(parseRangeHeader('items=0-1', size)).toBeNull();
		expect(parseRangeHeader('bytes=99999999999999999999-', size)).toBeNull();
	});
});

describe('createRangeStream', () => {
	test('不正な範囲では null を返す', () => {
		expect(createRangeStream('bytes=abc', 100, '/nonexistent')).toBeNull();
		expect(createRangeStream('bytes=100-', 100, '/nonexistent')).toBeNull();
	});
});
