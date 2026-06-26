import { json } from '@sveltejs/kit';
import { createList, getList, listLists } from '$lib/server/storage';

export async function POST({ request }) {
	const body = await request.json();
	try {
		const list = await createList({
			title: body.title,
			password: body.password,
			items: body.items
		});

		return json({ list });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Could not create list' }, { status: 500 });
	}
}

export async function GET({ url }) {
	const id = url.searchParams.get('id');
	if (id) {
		try {
			const list = await getList(id);
			return json({ list });
		} catch (error) {
			return json({ error: error instanceof Error ? error.message : 'List not found' }, { status: 404 });
		}
	}

	const offset = Number(url.searchParams.get('offset') ?? '0');
	const limit = Number(url.searchParams.get('limit') ?? '6');
	try {
		const lists = await listLists(offset, limit);
		return json({ lists, hasMore: lists.length === limit });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Could not load lists' }, { status: 500 });
	}
}
