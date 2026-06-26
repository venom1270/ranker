import { json } from '@sveltejs/kit';
import { deleteList, getList, submitRespondentScores } from '$lib/server/storage';

export async function GET({ params }) {
	try {
		const list = await getList(params.id);
		return json({ list });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'List not found' }, { status: 404 });
	}
}

export async function POST({ params, request }) {
	const body = await request.json();
	try {
		const result = await submitRespondentScores(params.id, body);
		return json(result);
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Could not submit scores' }, { status: 500 });
	}
}

export async function DELETE({ params, request }) {
	const body = await request.json().catch(() => ({}));
	try {
		await deleteList(params.id, body.password);
		return json({ success: true });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Could not delete list' }, { status: 400 });
	}
}
