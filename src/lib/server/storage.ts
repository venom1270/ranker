import { randomUUID } from 'node:crypto';
import { supabase } from './supabase';
import type { RankList, RankItem, ComparisonSummary } from '$lib/types';

function toRankItem(row: any): RankItem {
	return {
		id: row.id,
		name: row.name,
		score: row.creator_score ?? row.respondent_score ?? undefined
	};
}

function calculateComparison(list: RankList): ComparisonSummary {
	const creatorScores = list.items.map((item) => item.score ?? 0);
	const respondentScores = (list.respondentScores ?? []).map((item) => item.score ?? 0);

	const itemComparisons = creatorScores.map((creatorScore, index) => {
		const respondentScore = respondentScores[index] ?? 0;
		return {
			itemName: list.items[index]?.name ?? 'Unknown item',
			difference: Math.abs(creatorScore - respondentScore)
		};
	});

	let identicalCount = 0;
	let totalDifference = 0;
	let bestMatch = { itemName: '', difference: Number.POSITIVE_INFINITY };
	let worstMatch = { itemName: '', difference: Number.NEGATIVE_INFINITY };

	itemComparisons.forEach((entry) => {
		totalDifference += entry.difference;
		if (entry.difference === 0) identicalCount += 1;
		if (entry.difference < bestMatch.difference) bestMatch = entry;
		if (entry.difference > worstMatch.difference) worstMatch = entry;
	});

	const count = Math.max(creatorScores.length, 1);
	const averageDifference = Number((totalDifference / count).toFixed(1));
	const identicalPercent = Math.round((identicalCount / count) * 100);

	return {
		identicalCount,
		identicalPercent,
		averageDifference,
		bestMatch,
		worstMatch,
		itemComparisons,
		totalItems: count,
		averageAbsoluteDistance: averageDifference,
		matchingItems: identicalCount
	};
}

export async function createList(input: { title: string; password?: string; items: Array<{ name: string; score: number }> }) {
	const listId = randomUUID();
	const { data: listData, error: listError } = await supabase
		.from('ranks_lists')
		.insert({ id: listId, title: input.title, password: input.password ?? null })
		.select()
		.single();

	if (listError || !listData) throw new Error(listError?.message ?? 'Could not create list');

	const itemsToInsert = input.items.map((item) => ({
		id: randomUUID(),
		list_id: listId,
		name: item.name,
		creator_score: item.score
	}));

	const { error: itemsError } = await supabase.from('ranks_items').insert(itemsToInsert);
	if (itemsError) throw new Error(itemsError.message);

	return {
		id: listData.id,
		title: listData.title,
		password: listData.password ?? undefined,
		items: itemsToInsert.map((item) => ({ id: item.id, name: item.name, score: item.creator_score })),
		createdAt: listData.created_at,
		respondentScores: []
	};
}

export async function listLists(offset = 0, limit = 10) {
	const { data, error } = await supabase
		.from('ranks_lists')
		.select('*')
		.order('created_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (error) throw new Error(error.message);

	return (data ?? []).map((row) => ({
		id: row.id,
		title: row.title,
		password: row.password ?? undefined,
		items: [],
		createdAt: row.created_at
	}));
}

export async function deleteList(id: string, password?: string) {
	const { data: listData, error: listError } = await supabase
		.from('ranks_lists')
		.select('id, password')
		.eq('id', id)
		.single();

	if (listError || !listData) throw new Error(listError?.message ?? 'List not found');
	if (listData.password && password !== listData.password) {
		throw new Error('Password does not match');
	}

	const { error: responsesError } = await supabase.from('ranks_responses').delete().eq('list_id', id);
	if (responsesError) throw new Error(responsesError.message);

	const { error: itemsError } = await supabase.from('ranks_items').delete().eq('list_id', id);
	if (itemsError) throw new Error(itemsError.message);

	const { error: deleteError } = await supabase.from('ranks_lists').delete().eq('id', id);
	if (deleteError) throw new Error(deleteError.message);

	return true;
}

export async function getList(id: string) {
	const { data: listData, error: listError } = await supabase
		.from('ranks_lists')
		.select('*')
		.eq('id', id)
		.single();

	if (listError || !listData) throw new Error(listError?.message ?? 'List not found');

	const { data: itemsData, error: itemsError } = await supabase
		.from('ranks_items')
		.select('*')
		.eq('list_id', id)
		.order('name');

	if (itemsError) throw new Error(itemsError.message);

	return {
		id: listData.id,
		title: listData.title,
		password: listData.password ?? undefined,
		items: (itemsData ?? []).map(toRankItem),
		createdAt: listData.created_at,
		respondentScores: []
	};
}

export async function submitRespondentScores(id: string, payload: { scores: Array<{ itemId: string; score: number }> }) {
	const existing = await getList(id);

	const rows = payload.scores.map((entry) => ({
		id: randomUUID(),
		list_id: id,
		item_id: entry.itemId,
		respondent_score: entry.score
	}));

	const { error } = await supabase.from('ranks_responses').insert(rows);
	if (error) throw new Error(error.message);

	const listWithScores: RankList = {
		...existing,
		respondentScores: rows.map((row) => ({
			id: row.item_id,
			name: existing.items.find((item) => item.id === row.item_id)?.name ?? 'Unknown item',
			score: row.respondent_score
		}))
	};

	return {
		list: listWithScores,
		summary: calculateComparison(listWithScores)
	};
}
