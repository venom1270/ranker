<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { ComparisonSummary, RankList } from '$lib/types';

	let title = $state('');
	let password = $state('');
	let draftItems = $state([{ name: '', score: 5 }, { name: '', score: 5 }, { name: '', score: 5 }]);
	let createdList = $state<RankList | null>(null);
	let shareLink = $state('');
	let assignedPassword = $state('');
	let respondentScores = $state<Record<string, number>>({});
	let submittedSummary = $state<ComparisonSummary | null>(null);
	let isCreating = $state(false);
	let isSubmitting = $state(false);
	let error = $state('');
	let showPasswordView = $state(false);
	let passwordInput = $state('');
	let isLoadingSharedList = $state(false);
	let availableLists = $state<RankList[]>([]);
	let isLoadingLists = $state(false);
	let hasMoreLists = $state(true);
	let listSentinel = $state<HTMLElement | null>(null);
	let listPasswords = $state<Record<string, string>>({});

	function addDraftItem() {
		draftItems = [...draftItems, { name: '', score: 5 }];
	}

	function removeDraftItem(index: number) {
		draftItems = draftItems.filter((_, itemIndex) => itemIndex !== index);
	}

	function buildItems() {
		return draftItems
			.filter((item) => item.name.trim())
			.map((item) => ({
				name: item.name.trim(),
				score: Number(item.score)
			}));
	}

	async function loadLists(reset = false) {
		if (isLoadingLists || (!hasMoreLists && !reset)) {
			return;
		}

		isLoadingLists = true;
		const offset = reset ? 0 : availableLists.length;
		try {
			const response = await fetch(`/api/lists?offset=${offset}&limit=6`);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error ?? 'Could not load lists');
			}

			const newLists = (data.lists ?? []) as RankList[];
			availableLists = reset ? newLists : [...availableLists, ...newLists];
			hasMoreLists = data.hasMore ?? false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unexpected error';
		} finally {
			isLoadingLists = false;
		}
	}

	async function createList() {
		error = '';
		if (!title.trim()) {
			error = 'Please give your list a title.';
			return;
		}

		const preparedItems = buildItems();
		if (preparedItems.length < 2) {
			error = 'Add at least two items before creating a list.';
			return;
		}

		const missingScores = preparedItems.some((item) => Number.isNaN(item.score) || item.score < 1 || item.score > 10);
		if (missingScores) {
			error = 'Every item needs a creator score from 1 to 10.';
			return;
		}

		isCreating = true;
		const payload = {
			title: title.trim(),
			password: password.trim() || undefined,
			items: preparedItems
		};

		try {
			const response = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error ?? 'Could not create list');
			}

			createdList = data.list as RankList;
			shareLink = `${window.location.origin}/?list=${createdList.id}`;
			assignedPassword = createdList.password ?? '';
			showPasswordView = false;
			respondentScores = {};
			submittedSummary = null;
			passwordInput = '';
			draftItems = [{ name: '', score: 5 }, { name: '', score: 5 }, { name: '', score: 5 }];
			void loadLists(true);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unexpected error';
		} finally {
			isCreating = false;
		}
	}

	async function loadSharedList(listId: string) {
		isLoadingSharedList = true;
		error = '';
		try {
			const response = await fetch(`/api/lists/${listId}`);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error ?? 'List could not be loaded');
			}
			createdList = data.list as RankList;
			shareLink = `${window.location.origin}/?list=${createdList.id}`;
			assignedPassword = createdList.password ?? '';
			showPasswordView = false;
			passwordInput = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unexpected error';
		} finally {
			isLoadingSharedList = false;
		}
	}

	function openSharedList() {
		const listId = page.url.searchParams.get('list');
		if (listId) {
			goto(`/?list=${listId}`);
		}
	}

	async function submitScores() {
		error = '';
		isSubmitting = true;
		try {
			const response = await fetch(`/api/lists/${createdList?.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					scores: createdList?.items.map((item) => ({
						itemId: item.id,
						score: respondentScores[item.id] ?? 5
					}))
				})
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error ?? 'Could not submit scores');
			}
			submittedSummary = data.summary as ComparisonSummary;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unexpected error';
		} finally {
			isSubmitting = false;
		}
	}

	function revealCreatorScores() {
		if (!createdList?.password) {
			showPasswordView = true;
			return;
		}

		if (passwordInput === createdList.password) {
			showPasswordView = true;
			passwordInput = '';
		} else {
			error = 'The password does not match';
		}
	}

	async function deleteList(list: RankList) {
		error = '';
		const enteredPassword = listPasswords[list.id] ?? '';
		if (list.password && enteredPassword !== list.password) {
			error = 'The password is incorrect.';
			return;
		}

		try {
			const response = await fetch(`/api/lists/${list.id}`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password: enteredPassword })
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error ?? 'Could not delete list');
			}

			availableLists = availableLists.filter((item) => item.id !== list.id);
			if (createdList?.id === list.id) {
				createdList = null;
				shareLink = '';
				assignedPassword = '';
				showPasswordView = false;
				passwordInput = '';
				respondentScores = {};
				submittedSummary = null;
			}
			listPasswords = { ...listPasswords, [list.id]: '' };
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unexpected error';
		}
	}

	function resetView() {
		createdList = null;
		shareLink = '';
		assignedPassword = '';
		respondentScores = {};
		submittedSummary = null;
		error = '';
		showPasswordView = false;
		passwordInput = '';
		draftItems = [{ name: '', score: 5 }, { name: '', score: 5 }, { name: '', score: 5 }];
	}

	onMount(() => {
		void loadLists(true);
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					void loadLists(false);
				}
			},
			{ rootMargin: '400px' }
		);

		if (listSentinel) {
			observer.observe(listSentinel);
		}

		return () => observer.disconnect();
	});

	$effect(() => {
		const listId = page.url.searchParams.get('list');
		if (listId && !createdList) {
			void loadSharedList(listId);
		}
	});
</script>

<svelte:head>
	<title>Ranker</title>
	<meta name="description" content="Compare how two people rank the same list of items" />
</svelte:head>

<div class="shell">
	<header class="hero">
		<div>
			<h1>Ranker</h1>
			<p>Create a list, lock it with a password, and compare how two people score the same items.</p>
		</div>
		<button class="ghost" type="button" onclick={resetView}>Start over</button>
	</header>

	{#if error}
		<div class="alert">{error}</div>
	{/if}

	<div class="layout">
		<section class="card creator">
			<h2>Create a ranking list</h2>
			<label>
				<span>List title</span>
				<input bind:value={title} placeholder="Best songs of the year" />
			</label>
			<label>
				<span>Optional password</span>
				<input bind:value={password} placeholder="Lock the creator scores" />
			</label>
			<div class="draft-items">
				<div class="draft-header">
					<span>Items and creator scores</span>
					<button class="ghost small" type="button" onclick={addDraftItem}>+ Add item</button>
				</div>
				{#each draftItems as item, index}
					<div class="draft-row">
						<input bind:value={item.name} placeholder={`Item ${index + 1}`} />
						<input type="number" min="1" max="10" bind:value={item.score} />
						<button class="ghost small" type="button" onclick={() => removeDraftItem(index)}>Remove</button>
					</div>
				{/each}
			</div>
			<button type="button" onclick={createList} disabled={isCreating}>
				{isCreating ? 'Creating...' : 'Create list'}
			</button>
		</section>

		<section class="card viewer">
			{#if createdList}
				<h2>{createdList.title}</h2>
				<div class="share-link-block">
					<p>Share this link with someone else:</p>
					<a class="share-link" href={shareLink} target="_blank" rel="noreferrer" title={shareLink}>Open share link</a>
				</div>

				{#if assignedPassword}
					<div class="password-box">
						<label>
							<span>Unlock creator scores</span>
							<input bind:value={passwordInput} placeholder="Enter the password" />
						</label>
						<button type="button" onclick={revealCreatorScores}>Reveal creator scores</button>
					</div>
				{/if}

				{#if showPasswordView && assignedPassword}
					<div class="password-box secondary">
						<p>Creator scores are unlocked.</p>
						<ul>
							{#each createdList.items as item}
								<li>{item.name} — {item.score ?? 'not scored yet'}</li>
						{/each}
					</ul>
					</div>
				{/if}

				<div class="scores">
					{#each createdList.items as item}
						<label class="score-row">
							<span>{item.name}</span>
							<input type="range" min="1" max="10" bind:value={respondentScores[item.id]} />
							<strong class="score-value">{respondentScores[item.id] ?? 5}</strong>
						</label>
					{/each}
				</div>

				<button type="button" onclick={submitScores} disabled={isSubmitting}>
					{isSubmitting ? 'Comparing...' : 'Compare rankings'}
				</button>

				{#if submittedSummary}
					<div class="summary">
						<h3>Comparison summary</h3>
						<p>{submittedSummary.matchingItems} of {submittedSummary.totalItems} items matched exactly ({submittedSummary.identicalPercent}%).</p>
						<p>Average distance: {submittedSummary.averageAbsoluteDistance}</p>
						<p>Closest match: {submittedSummary.bestMatch.itemName} ({submittedSummary.bestMatch.difference} points)</p>
						<p>Farthest match: {submittedSummary.worstMatch.itemName} ({submittedSummary.worstMatch.difference} points)</p>
						<div class="comparison-list">
							{#each submittedSummary.itemComparisons as comparison}
								<div class="comparison-row">
									<span>{comparison.itemName}</span>
									<strong>{comparison.difference}</strong>
								</div>
						{/each}
					</div>
					</div>
				{/if}
			{:else}
				<h2>Ready to rank</h2>
				<p>Create a list to begin. The same list can then be shared with another person to compare their judgments.</p>
			{/if}
		</section>
	</div>

	<section class="card feed-card">
		<div class="feed-header">
			<h2>Recently created lists</h2>
			<p>Scroll down to load more.</p>
		</div>
		<div class="feed-list">
			{#each availableLists as list}
				<article class="feed-item">
					<div class="feed-item-main">
						<h3>{list.title}</h3>
						<p>{new Date(list.createdAt).toLocaleString()}</p>
					</div>
					<div class="feed-item-actions">
						<button class="ghost small" type="button" onclick={() => void loadSharedList(list.id)}>Open</button>
						{#if list.password}
							<input
								bind:value={listPasswords[list.id]}
								placeholder="Password"
							/>
						{/if}
						<button class="ghost small danger" type="button" onclick={() => void deleteList(list)}>Delete</button>
					</div>
				</article>
			{/each}
		</div>
		<div bind:this={listSentinel} class="sentinel">
			{#if isLoadingLists}
				Loading...
			{:else if hasMoreLists}
				Scroll for more
			{:else}
				No more lists
			{/if}
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		background: linear-gradient(135deg, #07111f, #102641 60%, #1b3a5b);
		color: #eaf4ff;
	}

	* {
		box-sizing: border-box;
	}

	.shell {
		min-height: 100vh;
		padding: 2rem;
	}

	.hero {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.hero h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 2.8rem);
	}

	.hero p {
		margin: 0.4rem 0 0;
		max-width: 44rem;
		color: #a7c8ea;
	}

	.layout {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}

	.card {
		background: rgba(8, 16, 28, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 24px;
		padding: 1.25rem;
		box-shadow: 0 16px 60px rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(18px);
	}

	label {
		display: block;
		margin-bottom: 0.85rem;
	}

	label span {
		display: block;
		margin-bottom: 0.35rem;
		font-weight: 600;
	}

	input,
	button {
		font: inherit;
	}

	input {
		width: 100%;
		padding: 0.8rem 0.9rem;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		background: rgba(255, 255, 255, 0.06);
		color: #f4faff;
	}

	input[type='range'] {
		width: 100%;
		padding: 0;
		border: none;
		background: transparent;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		accent-color: #7fd0ff;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 0.45rem;
		border-radius: 999px;
		background: linear-gradient(90deg, #3fa5ff 0%, #8d5cff 100%);
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		margin-top: -0.35rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		border: 2px solid #8d5cff;
		background: #f4faff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	}

	input[type='range']::-moz-range-track {
		height: 0.45rem;
		border-radius: 999px;
		background: linear-gradient(90deg, #3fa5ff 0%, #8d5cff 100%);
		border: none;
	}

	input[type='range']::-moz-range-thumb {
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		border: 2px solid #8d5cff;
		background: #f4faff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
	}

	button {
		padding: 0.8rem 1rem;
		border: none;
		border-radius: 999px;
		background: linear-gradient(135deg, #3fa5ff, #8d5cff);
		color: white;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.ghost {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.alert {
		margin-bottom: 1rem;
		padding: 0.85rem 1rem;
		background: rgba(255, 92, 92, 0.2);
		border: 1px solid rgba(255, 92, 92, 0.35);
		border-radius: 12px;
	}

	.password-box {
		margin: 1rem 0;
		padding: 0.9rem 1rem;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 12px;
	}

	.password-box.secondary {
		background: rgba(63, 165, 255, 0.12);
	}

	.share-link-block {
		margin: 0.85rem 0 1.2rem;
	}

	.share-link-block p {
		margin: 0 0 0.35rem;
	}

	.share-link {
		display: inline-flex;
		align-items: center;
		font-weight: 600;
		color: #7fd0ff;
		text-decoration: none;
	}

	.share-link:hover {
		text-decoration: underline;
	}

	.score-row {
		display: grid;
		grid-template-columns: 1.2fr minmax(0, 1.6fr) auto;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.7rem;
	}

	.score-value {
		min-width: 2.4rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.draft-items {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		margin-bottom: 1rem;
	}

	.draft-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.7rem;
		font-weight: 600;
	}

	.draft-row {
		display: grid;
		grid-template-columns: 1.5fr 0.5fr auto;
		gap: 0.6rem;
		align-items: center;
	}

	.small {
		padding: 0.55rem 0.8rem;
		border-radius: 999px;
	}

	.summary {
		margin-top: 1rem;
		padding: 0.95rem 1rem;
		background: rgba(104, 255, 180, 0.12);
		border: 1px solid rgba(104, 255, 180, 0.22);
		border-radius: 16px;
	}

	.feed-card {
		margin-top: 1.25rem;
	}

	.feed-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.9rem;
	}

	.feed-header p {
		margin: 0;
		color: #a7c8ea;
	}

	.feed-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.feed-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 1rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 16px;
	}

	.feed-item-main h3 {
		margin: 0 0 0.25rem;
	}

	.feed-item-main p {
		margin: 0;
		color: #a7c8ea;
		font-size: 0.92rem;
	}

	.feed-item-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.feed-item-actions input {
		max-width: 140px;
	}

	.danger {
		color: #ff8d8d;
		border-color: rgba(255, 141, 141, 0.3);
	}

	.sentinel {
		margin-top: 0.8rem;
		text-align: center;
		color: #a7c8ea;
		font-size: 0.95rem;
	}

	.comparison-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}

	.comparison-row {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.7rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 10px;
	}

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.hero {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	@media (max-width: 640px) {
		.shell {
			padding: 1rem;
		}

		.card {
			padding: 1rem;
			border-radius: 18px;
		}

		.hero h1 {
			font-size: 1.8rem;
		}

		.draft-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.draft-row {
			grid-template-columns: 1fr;
		}

		.score-row {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.feed-item {
			flex-direction: column;
			align-items: stretch;
		}

		.feed-item-actions {
			flex-wrap: wrap;
		}

		.feed-item-actions input {
			max-width: none;
			width: 100%;
		}

		.feed-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
