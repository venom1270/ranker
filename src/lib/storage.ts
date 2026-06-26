import type { RankList, ScoreSubmissionPayload, ComparisonSummary } from './types';

const lists = new Map<string, RankList>();

function randomId() {
	return Math.random().toString(36).slice(2, 10);
}

function normalizeScores(items: Array<{ id: string; name?: string; score?: number }>) {
	return items.map((item) => ({
		id: item.id,
		name: item.name ?? 'Unknown item',
		score: typeof item.score === 'number' ? item.score : 0
	}));
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
	return {
		identicalCount,
		identicalPercent: Math.round((identicalCount / count) * 100),
		averageDifference,
		bestMatch,
		worstMatch,
		itemComparisons,
		totalItems: count,
		averageAbsoluteDistance: averageDifference,
		matchingItems: identicalCount
	};
}

export function createList(input: { title: string; password?: string; items: Array<{ name: string; score: number }> }) {
	const list: RankList = {
		id: randomId(),
		title: input.title,
		password: input.password || undefined,
		items: input.items.map((item, index) => ({
			id: `${randomId()}-${index}`,
			name: item.name,
			score: item.score
		})),
		createdAt: new Date().toISOString()
	};

	lists.set(list.id, list);
	return list;
}

export function getList(id: string) {
	return lists.get(id);
}

export function submitRespondentScores(id: string, payload: ScoreSubmissionPayload) {
	const existing = lists.get(id);
	if (!existing) {
		throw new Error('List not found');
	}

	const respondentScores = payload.scores.map((entry) => ({
		id: entry.itemId,
		name: existing.items.find((item) => item.id === entry.itemId)?.name ?? 'Unknown item',
		score: entry.score
	}));

	const updated: RankList = {
		...existing,
		respondentScores: normalizeScores(respondentScores)
	};

	lists.set(id, updated);
	return {
		list: updated,
		summary: calculateComparison(updated)
	};
}

export function getSupabasePlan() {
	return {
		description: 'Supabase-ready backend adapter shell',
		notes: [
			'Create server-side route handlers for create/list/submit flows.',
			'Use a service role client only on the server.',
			'Keep the current in-memory implementation as the fallback for local development.'
		]
	};
}
