/* eslint no-unused-vars: 0 */

const fs = require('fs');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const chalk = require('chalk');
const caniuseDB = require('caniuse-db/data.json').data;

const outfile = 'trace.json';

const GOOGLE_SEARCH_CHROME_VERSION = process.env.CHROME_VERSION || 41;

exports.start = function (websiteUrl) {
	if (websiteUrl.length === 0) {
		return 'Please enter full name';
	}
	return websiteUrl;
};

exports.runPuppeteer = function (websiteUrl) {
	const url = websiteUrl || 'https://www.chromestatus.com/features';
	const BlinkFeatureNameToCaniuseName = {
		AddEventListenerPassiveTrue: 'passive-event-listener',
		AddEventListenerPassiveFalse: 'passive-event-listener',
		PromiseConstructor: 'promises',
		PromiseResolve: 'promises',
		PromiseReject: 'promises',
		V8PromiseChain: 'promises',
		DocumentRegisterElement: 'custom-elements',
		V0CustomElementsRegisterHTMLCustomTag: 'custom-elements',
		V0CustomElementsCreateCustomTagElement: 'custom-elements',
		V0CustomElementsRegisterHTMLTypeExtension: 'custom-elements',
		V0CustomElementsCreateTypeExtensionElement: 'custom-elements',
		CSSSelectorPseudoMatches: 'css-matches-pseudo',
		CustomElementRegistryDefine: 'custom-elementsv1',
		ElementAttachShadow: 'shadowdomv1',
		ElementAttachShadowOpen: 'shadowdomv1',
		ElementAttachShadowClosed: 'shadowdomv1',
		CSSSelectorPseudoSlotted: 'shadowdomv1',
		HTMLSlotElement: 'shadowdomv1',
		CSSSelectorPseudoHost: 'shadowdom',
		ElementCreateShadowRoot: 'shadowdom',
		CSSSelectorPseudoShadow: 'shadowdom',
		CSSSelectorPseudoContent: 'shadowdom',
		CSSSelectorPseudoHostContext: 'shadowdom',
		HTMLShadowElement: 'shadowdom',
		HTMLContentElement: 'shadowdom',
		LinkRelPreconnect: 'link-rel-preconnect',
		LinkRelPreload: 'link-rel-preload',
		HTMLImports: 'imports',
		HTMLImportsAsyncAttribute: 'imports',
		LinkRelModulePreload: 'es6-module',
		V8BroadcastChannelConstructor: 'broadcastchannel',
		Fetch: 'fetch',
		GlobalCacheStorage: 'cachestorage', // Missing: https://github.com/Fyrd/caniuse/issues/3122
		OffMainThreadFetch: 'fetch',
		IntersectionObserverConstructor: 'intersectionobserver',
		V8WindowRequestIdleCallbackMethod: 'requestidlecallback',
		NotificationPermission: 'notifications',
		UnprefixedPerformanceTimeline: 'user-timing',
		V8ElementGetBoundingClientRectMethod: 'getboundingclientrect',
		AddEventListenerThirdArgumentIsObject: 'once-event-listener',
		contain: 'css-containment',
		'tab-size': 'css3-tabsize',
		// Explicitly disabled by search https://developers.google.com/search/docs/guides/rendering
		UnprefixedIndexedDB: 'indexeddb',
		DocumentCreateEventWebGLContextEvent: 'webgl',
		CSSGridLayout: 'css-grid',
		CSSValueDisplayContents: 'css-display-contents',
		CSSPaintFunction: 'css-paint-api',
		WorkerStart: 'webworkers',
		ServiceWorkerControlledPage: 'serviceworkers',
		PrepareModuleScript: 'es6-module'
		// CookieGet:
		// CookieSet
	};

	/**
	 * Unique items based on obj property.
	 * @param {!Array} items
	 * @param {string} propName Property name to filter on.
	 * @return {!Array} unique array of items
	 */
	function uniqueByProperty(items, propName) {
		const posts = Array.from(
			items
				.reduce((map, item) => {
					return map.set(item[propName], item);
				}, new Map())
				.values()
		);
		return posts;
	}

	/**
	 * Sorts array of features by their name
	 * @param {!Object} a
	 * @param {!Object} b
	 */
	function sortByName(a, b) {
		if (a.name < b.name) {
			return -1;
		}
		if (a.name > b.name) {
			return 1;
		}
		return 0;
	}

	function printHeader(usage) {
		console.log('');
		console.log(
			`${chalk.bold(chalk.yellow('CAREFUL'))}: using ${
				usage.FeatureFirstUsed.length
			} HTML/JS, ${
				usage.CSSFirstUsed.length
			} CSS features. Some features are ${chalk.underline(
				'not'
			)} supported by the Google Search crawler.`
		);
		console.log(
			`The bot runs ${chalk.redBright(
				'Chrome ' + GOOGLE_SEARCH_CHROME_VERSION
			)}, which may not render your page correctly when it's being indexed.`
		);
		console.log('');
		console.log(
			chalk.dim(
				'More info at https://developers.google.com/search/docs/guides/rendering.'
			)
		);
		console.log('');
		console.log(`Features used which are not supported by Google Search`);
		console.log('');
	}

	/**
	 * Returns true if `feature` is supported by the Google Search bot.
	 * @param {string} feature caniuse.com feature name/id.
	 * @return {boolean} True if the feature is (likely) supported by Google Search.
	 */
	function supportedByGoogleSearch(feature) {
		const data = caniuseDB[feature];
		if (!data) {
			return null;
		}
		const support = data.stats.chrome[GOOGLE_SEARCH_CHROME_VERSION];
		return support === 'y';
	}

	/**
	 * Fetches HTML/JS feature id/names from chromestatus.com.
	 * @param {!Browser} browser
	 * @return {!Map<number, string>} key/val pairs of ids -> feature name
	 */
	async function fetchFeatureToNameMapping() {
		const resp = await fetch(
			'https://www.chromestatus.com/data/blink/features'
		);
		return new Map(await resp.json());
	}

	/**
	 * Fetches CSS property id/names from chromestatus.com
	 * @param {!Browser} browser
	 * @return {!Map<number, string>} key/val pairs of ids -> feature name
	 */
	async function fetchCSSFeatureToNameMapping(browser) {
		const resp = await fetch(
			'https://www.chromestatus.com/data/blink/cssprops'
		);
		return new Map(await resp.json());
	}

	/**
	 * Start a trace during load to capture web platform features used by the page.
	 * @param {!Browser} browser
	 * @return {!Object}
	 */
	async function collectFeatureTraceEvents(browser) {
		const page = await browser.newPage();

		console.log(chalk.cyan(`Trace started.`));

		await page.tracing.start({
			path: outfile,
			categories: [
				'-*',
				'disabled-by-default-devtools.timeline', // For TracingStartedInPage
				'disabled-by-default-blink.feature_usage'
			]
		});
		console.log(chalk.cyan(`Navigating to ${url}`));
		await page.goto(url, {
			waitUntil: 'networkidle2'
		});
		console.log(chalk.cyan(`Waiting for page to be idle...`));
		await page.waitFor(5000); // Add a little more time in case other features are used.
		await page.tracing.stop();

		console.log(chalk.cyan(`Trace complete.`));

		const trace = JSON.parse(
			fs.readFileSync(outfile, {
				encoding: 'utf-8'
			})
		);

		// Filter out all trace events that aren't 1. blink feature usage
		// and 2. from the same process/thread id as our test page's main thread.
		const traceStartEvent = trace.traceEvents.find(
			e => e.name === 'TracingStartedInPage'
		);
		const events = trace.traceEvents.filter(e => {
			return (
				e.cat === 'disabled-by-default-blink.feature_usage' &&
				e.pid === traceStartEvent.pid &&
				e.tid === traceStartEvent.tid
			);
		});

		await page.close();

		return events;
	}

	/**
	 * @param {!Object} feature
	 */
	function printFeatureName(feature, url = null) {
		const suffix = url ? `: ${url}` : '';
		if (feature.css) {
			console.log(chalk.grey('-'), `CSS \`${feature.name}\`${suffix}`);
		} else {
			console.log(chalk.grey('-'), `${feature.name}${suffix}`);
		}
	}

	(async () => {
		const browser = await puppeteer.launch({
			// Headless: false,
		});

		// Parallelize the separate page loads.
		const [featureMap, cssFeatureMap, traceEvents] = await Promise.all([
			fetchFeatureToNameMapping(),
			fetchCSSFeatureToNameMapping(),
			collectFeatureTraceEvents(browser)
		]);

		const usage = traceEvents.reduce((usage, e) => {
			if (!(e.name in usage)) {
				usage[e.name] = [];
			}
			const isCSS = e.name === 'CSSFirstUsed';
			const id = e.args.feature;
			const name = isCSS ? cssFeatureMap.get(id) : featureMap.get(id);
			usage[e.name].push({
				id,
				name,
				ts: e.ts,
				css: isCSS
			});

			return usage;
		}, {});

		// Unique events based on feature property id.
		usage.FeatureFirstUsed = uniqueByProperty(usage.FeatureFirstUsed, 'id');
		usage.CSSFirstUsed = uniqueByProperty(usage.CSSFirstUsed, 'id');

		printHeader(usage);

		const allFeaturesUsed = Object.entries(
			[...usage.FeatureFirstUsed, ...usage.CSSFirstUsed].sort(sortByName)
		);
		for (const [id, feature] of allFeaturesUsed) {
			console.log(id);
			const caniuseName = BlinkFeatureNameToCaniuseName[feature.name];
			const supported = supportedByGoogleSearch(caniuseName);
			if (caniuseName && !supported) {
				const url = chalk.magentaBright(
					`https://caniuse.com/#feat=${caniuseName}`
				);
				printFeatureName(feature, url);
			}
		}
		console.log('');
		console.log('All features used on the page:');
		console.log('');
		for (const [id, feature] of allFeaturesUsed) {
			console.log(id);
			printFeatureName(feature);
		}
		console.log('');

		fs.unlinkSync(outfile);

		await browser.close();
	})();
};
