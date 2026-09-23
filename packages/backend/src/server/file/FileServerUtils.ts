/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { FILE_TYPE_BROWSERSAFE } from '@/const.js';
import { contentDisposition } from '@/misc/content-disposition.js';
import type { IImageStreamable } from '@/core/ImageProcessingService.js';
import type { FastifyReply } from 'fastify';

export type RangeStream = {
	stream: fs.ReadStream;
	start: number;
	end: number;
	chunksize: number;
};

/**
 * Range ヘッダーを解釈する。不正な場合は null を返す
 */
export function parseRangeHeader(rangeHeader: string, size: number): { start: number; end: number } | null {
	const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
	if (match == null) return null;

	const startStr = match[1];
	const endStr = match[2];
	if (startStr === '' && endStr === '') return null;

	let start: number;
	let end: number;

	if (startStr === '') {
		// 末尾からのバイト数指定
		const suffix = Number(endStr);
		if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(startStr);
		if (!Number.isSafeInteger(start) || start >= size) return null;
		end = endStr === '' ? size - 1 : Number(endStr);
		if (!Number.isSafeInteger(end) || end < start) return null;
		end = Math.min(end, size - 1);
	}

	return { start, end };
}

/**
 * Range リクエストに対応したストリームを作成する。不正な Range の場合は null を返す
 */
export function createRangeStream(rangeHeader: string, size: number, path: string): RangeStream | null {
	const range = parseRangeHeader(rangeHeader, size);
	if (range == null) return null;

	const { start, end } = range;
	const chunksize = end - start + 1;

	return {
		stream: fs.createReadStream(path, { start, end }),
		start,
		end,
		chunksize,
	};
}

/**
 * ストリームにcleanupハンドラを設定する
 * ストリームでない場合は即座にcleanupを実行する
 */
export function attachStreamCleanup(data: IImageStreamable['data'], cleanup: () => void): void {
	if ('pipe' in data && typeof data.pipe === 'function') {
		data.on('end', cleanup);
		data.on('close', cleanup);
	} else {
		cleanup();
	}
}

/**
 * MIME タイプがブラウザセーフかどうかに応じて Content-Type を返す
 */
export function getSafeContentType(mime: string): string {
	return FILE_TYPE_BROWSERSAFE.includes(mime) ? mime : 'application/octet-stream';
}

/**
 * Range リクエストを処理してストリームを返す
 * Range ヘッダーがない場合は通常のストリームを返す
 */
export function handleRangeRequest(
	reply: FastifyReply,
	rangeHeader: string | undefined,
	size: number,
	path: string,
): fs.ReadStream {
	if (rangeHeader && size > 0) {
		const range = createRangeStream(rangeHeader, size, path);
		if (range != null) {
			reply.header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
			reply.header('Accept-Ranges', 'bytes');
			reply.header('Content-Length', range.chunksize);
			reply.code(206);
			return range.stream;
		}
	}
	return fs.createReadStream(path);
}

export type FileResponseOptions = {
	mime: string;
	filename: string;
	size?: number;
	cacheControl?: string;
};

/**
 * ファイルレスポンス用の共通ヘッダーを設定する
 */
export function setFileResponseHeaders(
	reply: FastifyReply,
	options: FileResponseOptions,
): void {
	reply.header('Content-Type', getSafeContentType(options.mime));
	reply.header('Cache-Control', options.cacheControl ?? 'max-age=31536000, immutable');
	reply.header('Content-Disposition', contentDisposition('inline', options.filename));
	if (options.size !== undefined) {
		reply.header('Content-Length', options.size);
	}
}

/**
 * cleanup が必要なファイルかどうかを判定する型ガード
 */
export function needsCleanup<T extends { kind?: string; cleanup?: () => void }>(file: T): file is T & { cleanup: () => void } {
	return 'cleanup' in file && typeof file.cleanup === 'function';
}
