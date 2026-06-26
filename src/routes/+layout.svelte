<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg?v=2" />
	<link rel="shortcut icon" href="/favicon.svg?v=2" />
</svelte:head>

{@render children()}
