export interface RankItem {
	id: string;
	name: string;
	score?: number;
}

export interface RankList {
	id: string;
	title: string;
	password?: string;
	items: RankItem[];
	createdAt: string;
	respondentScores?: RankItem[];
}

export interface CreateListPayload {
	title: string;
	password?: string;
	items: Array<{
		name: string;
		score: number;
	}>;
}

export interface ScoreSubmissionPayload {
	scores: Array<{
		itemId: string;
		score: number;
	}>;
}

export interface ComparisonSummary {
	identicalCount: number;
	identicalPercent: number;
	averageDifference: number;
	bestMatch: {
		itemName: string;
		difference: number;
	};
	worstMatch: {
		itemName: string;
		difference: number;
	};
	itemComparisons: Array<{
		itemName: string;
		difference: number;
	}>;
	totalItems: number;
	averageAbsoluteDistance: number;
	matchingItems: number;
}
