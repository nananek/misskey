/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';
process.env.FORCE_FOLLOW_REMOTE_USER_FOR_TESTING = 'true';

import * as assert from 'assert';
import { signup, api, post, react, startServer, waitFire, sleep } from '../utils.js';
import type { INestApplicationContext } from '@nestjs/common';
import type * as misskey from 'misskey-js';

let app: INestApplicationContext;

beforeAll(async () => {
	app = await startServer();
}, 1000 * 60 * 2);

afterAll(async () => {
	await app.close();
});

describe('Timelines', () => {
	describe('Home TL', () => {
		test.concurrent('自分の visibility: followers なノートが含まれる', async () => {
			const [alice] = await Promise.all([signup()]);

			const aliceNote = await post(alice, { text: 'hi', visibility: 'followers' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === aliceNote.id), true);
			assert.strictEqual(res.body.find((note: any) => note.id === aliceNote.id).text, 'hi');
		});

		test.concurrent('フォローしているユーザーのノートが含まれる', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi' });
			const carolNote = await post(carol, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('フォローしているユーザーの visibility: followers なノートが含まれる', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'followers' });
			const carolNote = await post(carol, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.find((note: any) => note.id === bobNote.id).text, 'hi');
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: false でフォローしているユーザーの他人への返信が含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: true でフォローしているユーザーの他人への返信が含まれる', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: true でフォローしているユーザーの他人へのDM返信が含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id, visibility: 'specified', visibleUserIds: [carolNote.id] });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: true でフォローしているユーザーの他人の visibility: followers な投稿への返信が含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			const carolNote = await post(carol, { text: 'hi', visibility: 'followers' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: true でフォローしているユーザーの行った別のフォローしているユーザーの visibility: followers な投稿への返信が含まれる', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/create', { userId: carol.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			const carolNote = await post(carol, { text: 'hi', visibility: 'followers' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), true);
			assert.strictEqual(res.body.find((note: any) => note.id === carolNote.id).text, 'hi');
		});

		test.concurrent('withReplies: true でフォローしているユーザーの行った別のフォローしているユーザーの投稿への visibility: specified な返信が含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/create', { userId: carol.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id, visibility: 'specified', visibleUserIds: [carolNote.id] });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), true);
		});

		test.concurrent('withReplies: false でフォローしているユーザーのそのユーザー自身への返信が含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote1 = await post(bob, { text: 'hi' });
			const bobNote2 = await post(bob, { text: 'hi', replyId: bobNote1.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote1.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === bobNote2.id), true);
		});

		test.concurrent('自分の他人への返信が含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const bobNote = await post(bob, { text: 'hi' });
			const aliceNote = await post(alice, { text: 'hi', replyId: bobNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === aliceNote.id), true);
		});

		test.concurrent('フォローしているユーザーの他人の投稿のリノートが含まれる', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { renoteId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('[withRenotes: false] フォローしているユーザーの他人の投稿のリノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { renoteId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {
				withRenotes: false,
			}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('[withRenotes: false] フォローしているユーザーの他人の投稿の引用が含まれる', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', renoteId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {
				withRenotes: false,
			}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('フォローしているユーザーの他人への visibility: specified なノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'specified', visibleUserIds: [carol.id] });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
		});

		test.concurrent('フォローしているユーザーが行ったミュートしているユーザーのリノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/mute/create', { userId: carol.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', renoteId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: true でフォローしているユーザーが行ったミュートしているユーザーの投稿への返信が含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			await api('/mute/create', { userId: carol.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('フォローしているリモートユーザーのノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup({ host: 'example.com' })]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		test.concurrent('フォローしているリモートユーザーの visibility: home なノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup({ host: 'example.com' })]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'home' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});
	});

	describe('Local TL', () => {
		test.concurrent('visibility: home なノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			const carolNote = await post(carol, { text: 'hi', visibility: 'home' });
			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('リモートユーザーのノートが含まれない', async () => {
			const [alice, bob] = await Promise.all([signup(), signup({ host: 'example.com' })]);

			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
		});

		// 含まれても良いと思うけど実装が面倒なので含まれない
		test.concurrent('フォローしているユーザーの visibility: home なノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', {
				userId: carol.id,
			}, alice);
			const carolNote = await post(carol, { text: 'hi', visibility: 'home' });
			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('ミュートしているユーザーのノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/mute/create', { userId: carol.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('フォローしているユーザーが行ったミュートしているユーザーのリノートが含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/mute/create', { userId: carol.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', renoteId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});

		test.concurrent('withReplies: true でフォローしているユーザーが行ったミュートしているユーザーの投稿への返信が含まれない', async () => {
			const [alice, bob, carol] = await Promise.all([signup(), signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			await api('/following/update', { userId: bob.id, withReplies: true }, alice);
			await api('/mute/create', { userId: carol.id }, alice);
			const carolNote = await post(carol, { text: 'hi' });
			const bobNote = await post(bob, { text: 'hi', replyId: carolNote.id });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
			assert.strictEqual(res.body.some((note: any) => note.id === carolNote.id), false);
		});
	});

	describe('Social TL', () => {
		test.concurrent('ローカルユーザーのノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/hybrid-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		test.concurrent('ローカルユーザーの visibility: home なノートが含まれない', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const bobNote = await post(bob, { text: 'hi', visibility: 'home' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/hybrid-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
		});

		test.concurrent('フォローしているローカルユーザーの visibility: home なノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'home' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/hybrid-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		test.concurrent('リモートユーザーのノートが含まれない', async () => {
			const [alice, bob] = await Promise.all([signup(), signup({ host: 'example.com' })]);

			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/local-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
		});

		test.concurrent('フォローしているリモートユーザーのノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup({ host: 'example.com' })]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/hybrid-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		test.concurrent('フォローしているリモートユーザーの visibility: home なノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup({ host: 'example.com' })]);

			await api('/following/create', { userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'home' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/hybrid-timeline', {}, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});
	});

	describe('User List TL', () => {
		test.concurrent('リスインしているフォローしていないユーザーのノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const list = await api('/users/lists/create', { name: 'list' }, alice).then(res => res.body);
			await api('/users/lists/push', { listId: list.id, userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/user-list-timeline', { listId: list.id }, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		test.concurrent('リスインしているフォローしていないユーザーの visibility: home なノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const list = await api('/users/lists/create', { name: 'list' }, alice).then(res => res.body);
			await api('/users/lists/push', { listId: list.id, userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'home' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/user-list-timeline', { listId: list.id }, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		/* 未実装
		test.concurrent('リスインしているフォローしていないユーザーの visibility: followers なノートが含まれない', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const list = await api('/users/lists/create', { name: 'list' }, alice).then(res => res.body);
			await api('/users/lists/push', { listId: list.id, userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'followers' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/user-list-timeline', { listId: list.id }, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
		});
		*/

		test.concurrent('リスインしているフォローしていないユーザーの visibility: followers なノートが含まれるが隠される', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			const list = await api('/users/lists/create', { name: 'list' }, alice).then(res => res.body);
			await api('/users/lists/push', { listId: list.id, userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'followers' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/user-list-timeline', { listId: list.id }, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.find((note: any) => note.id === bobNote.id).text, null);
		});

		test.concurrent('リスインしているフォローしているユーザーの visibility: home なノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const list = await api('/users/lists/create', { name: 'list' }, alice).then(res => res.body);
			await api('/users/lists/push', { listId: list.id, userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'home' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/user-list-timeline', { listId: list.id }, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
		});

		test.concurrent('リスインしているフォローしているユーザーの visibility: followers なノートが含まれる', async () => {
			const [alice, bob] = await Promise.all([signup(), signup()]);

			await api('/following/create', { userId: bob.id }, alice);
			const list = await api('/users/lists/create', { name: 'list' }, alice).then(res => res.body);
			await api('/users/lists/push', { listId: list.id, userId: bob.id }, alice);
			const bobNote = await post(bob, { text: 'hi', visibility: 'followers' });

			await sleep(100); // redisに追加されるのを待つ

			const res = await api('/notes/user-list-timeline', { listId: list.id }, alice);

			assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), true);
			assert.strictEqual(res.body.find((note: any) => note.id === bobNote.id).text, 'hi');
		});
	});

	// TODO: リノートミュート済みユーザーのテスト
	// TODO: withFilesのテスト
});
