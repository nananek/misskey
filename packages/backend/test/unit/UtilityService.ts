/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import type { Config } from '@/config.js';
import type { MiMeta } from '@/models/Meta.js';
import { UtilityService } from '@/core/UtilityService.js';

function makeService(options: {
	host?: string;
	federation?: MiMeta['federation'];
	federationHosts?: string[];
	blockedHosts?: string[];
} = {}): UtilityService {
	const config = { host: options.host ?? 'misskey.test' } as unknown as Config;
	const meta = {
		federation: options.federation ?? 'all',
		federationHosts: options.federationHosts ?? [],
		blockedHosts: options.blockedHosts ?? [],
	} as unknown as MiMeta;
	return new UtilityService(config, meta);
}

describe('UtilityService', () => {
	describe('isFederationAllowedHost', () => {
		test('federation: all では任意のホストを許可する', () => {
			const service = makeService({ federation: 'all' });
			expect(service.isFederationAllowedHost('example.com')).toBe(true);
			expect(service.isFederationAllowedHost('sub.example.com')).toBe(true);
		});

		test('federation: all でも blockedHosts は拒否する（サブドメイン含む）', () => {
			const service = makeService({ federation: 'all', blockedHosts: ['blocked.example'] });
			expect(service.isFederationAllowedHost('blocked.example')).toBe(false);
			expect(service.isFederationAllowedHost('sub.blocked.example')).toBe(false);
			expect(service.isFederationAllowedHost('notblocked.example')).toBe(true);
		});

		test('federation: none では自ホスト以外を拒否する', () => {
			const service = makeService({ federation: 'none' });
			expect(service.isFederationAllowedHost('example.com')).toBe(false);
			expect(service.isFederationAllowedHost('misskey.test')).toBe(true);
		});

		test('federation: specified では federationHosts の完全一致のみ許可する', () => {
			const service = makeService({ federation: 'specified', federationHosts: ['example.com'] });
			expect(service.isFederationAllowedHost('example.com')).toBe(true);
			expect(service.isFederationAllowedHost('other.example')).toBe(false);
		});

		test('federation: specified ではサブドメインを暗黙に許可しない', () => {
			const service = makeService({ federation: 'specified', federationHosts: ['example.com'] });
			expect(service.isFederationAllowedHost('sub.example.com')).toBe(false);
			expect(service.isFederationAllowedHost('example.com.evil.example')).toBe(false);
		});

		test('federation: specified ではサブドメインを明示すれば許可する', () => {
			const service = makeService({ federation: 'specified', federationHosts: ['sub.example.com'] });
			expect(service.isFederationAllowedHost('sub.example.com')).toBe(true);
		});

		test('federationHosts の大文字・IDN を正規化して比較する', () => {
			const service = makeService({ federation: 'specified', federationHosts: ['Example.COM', '日本語.example'] });
			expect(service.isFederationAllowedHost('example.com')).toBe(true);
			expect(service.isFederationAllowedHost('EXAMPLE.com')).toBe(true);
			expect(service.isFederationAllowedHost('xn--wgv71a119e.example')).toBe(true);
		});

		test('federation: specified でも自ホストは許可する', () => {
			const service = makeService({ federation: 'specified', federationHosts: [] });
			expect(service.isFederationAllowedHost('misskey.test')).toBe(true);
		});

		test('許可とブロックが重なった場合はブロックを優先する', () => {
			const service = makeService({ federation: 'specified', federationHosts: ['both.example'], blockedHosts: ['both.example'] });
			expect(service.isFederationAllowedHost('both.example')).toBe(false);
		});

		test('ポート付きホストは specified では一致しない（既知の制限）', () => {
			const service = makeService({ federation: 'specified', federationHosts: ['example.com'] });
			expect(service.isFederationAllowedHost('example.com:8443')).toBe(false);
		});
	});

	describe('isBlockedHost', () => {
		test('完全一致とサブドメインをブロックする', () => {
			const service = makeService();
			expect(service.isBlockedHost(['example.com'], 'example.com')).toBe(true);
			expect(service.isBlockedHost(['example.com'], 'sub.example.com')).toBe(true);
			expect(service.isBlockedHost(['example.com'], 'example.com.evil.example')).toBe(false);
			expect(service.isBlockedHost(['example.com'], 'notexample.com')).toBe(false);
		});

		test('host が null の場合はブロックしない', () => {
			const service = makeService();
			expect(service.isBlockedHost(['example.com'], null)).toBe(false);
		});
	});
});
