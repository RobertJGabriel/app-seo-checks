/*	eslint	no-unused-vars:	0	*/

const	fs	=	require('fs');
const	core	=	require('./core');
const	engine	=	require('./myapp/bin/www');
const	puppeteer	=	require('puppeteer');
const	fetch	=	require('node-fetch');
const	chalk	=	require('chalk');
const	caniuseDB	=	require('caniuse-db/data.json').data;
let	url	=	process.env.URL	||	'https://www.chromestatus.com/features';
const	outfile	=	'trace.json';

const	BlinkFeatureNameToCaniuseName	=	{
	AddEventListenerPassiveTrue:	'passive-event-listener',
	AddEventListenerPassiveFalse:	'passive-event-listener',
	PromiseConstructor:	'promises',
	PromiseResolve:	'promises',
	PromiseReject:	'promises',
	V8PromiseChain:	'promises',
	DocumentRegisterElement:	'custom-elements',
	V0CustomElementsRegisterHTMLCustomTag:	'custom-elements',
	V0CustomElementsCreateCustomTagElement:	'custom-elements',
	V0CustomElementsRegisterHTMLTypeExtension:	'custom-elements',
	V0CustomElementsCreateTypeExtensionElement:	'custom-elements',
	CSSSelectorPseudoMatches:	'css-matches-pseudo',
	CustomElementRegistryDefine:	'custom-elementsv1',
	ElementAttachShadow:	'shadowdomv1',
	ElementAttachShadowOpen:	'shadowdomv1',
	ElementAttachShadowClosed:	'shadowdomv1',
	CSSSelectorPseudoSlotted:	'shadowdomv1',
	HTMLSlotElement:	'shadowdomv1',
	CSSSelectorPseudoHost:	'shadowdom',
	ElementCreateShadowRoot:	'shadowdom',
	CSSSelectorPseudoShadow:	'shadowdom',
	CSSSelectorPseudoContent:	'shadowdom',
	CSSSelectorPseudoHostContext:	'shadowdom',
	HTMLShadowElement:	'shadowdom',
	HTMLContentElement:	'shadowdom',
	LinkRelPreconnect:	'link-rel-preconnect',
	LinkRelPreload:	'link-rel-preload',
	HTMLImports:	'imports',
	HTMLImportsAsyncAttribute:	'imports',
	LinkRelModulePreload:	'es6-module',
	V8BroadcastChannel_Constructor:	'broadcastchannel',
	Fetch:	'fetch',
	GlobalCacheStorage:	'cachestorage',
	OffMainThreadFetch:	'fetch',
	IntersectionObserver_Constructor:	'intersectionobserver',
	V8Window_RequestIdleCallback_Method:	'requestidlecallback',
	NotificationPermission:	'notifications',
	UnprefixedPerformanceTimeline:	'user-timing',
	V8Element_GetBoundingClientRect_Method:	'getboundingclientrect',
	AddEventListenerThirdArgumentIsObject:	'once-event-listener',
	contain:	'css-containment',
	'tab-size':	'css3-tabsize',
	UnprefixedIndexedDB:	'indexeddb',
	DocumentCreateEventWebGLContextEvent:	'webgl',
	CSSGridLayout:	'css-grid',
	CSSValueDisplayContents:	'css-display-contents',
	CSSPaintFunction:	'css-paint-api',
	WorkerStart:	'webworkers',
	ServiceWorkerControlledPage:	'serviceworkers',
	PrepareModuleScript:	'es6-module'
};

async	function	start(urls)	{
	url	=	urls;
	const	browser	=	await	puppeteer.launch({
		args:	['--no-sandbox',	'--disable-setuid-sandbox']
	});

	//	Parallelize	the	separate	page	loads.
	const	[featureMap,	cssFeatureMap,	traceEvents]	=	await	Promise.all([
		core.fetchFeatureToNameMapping(),
		core.fetchCSSFeatureToNameMapping(),
		core.collectFeatureTraceEvents(browser,	url)
	]);

	const	usage	=	traceEvents.reduce((usage,	e)	=>	{
		if	(!(e.name	in	usage))	{
			usage[e.name]	=	[];
		}
		const	isCSS	=	e.name	===	'CSSFirstUsed';
		const	id	=	e.args.feature;
		const	name	=	isCSS	?	cssFeatureMap.get(id)	:	featureMap.get(id);
		usage[e.name].push({
			id,
			name,
			ts:	e.ts,
			css:	isCSS
		});
		return	usage;
	},	{});

	//	Unique	events	based	on	feature	property	id.
	usage.FeatureFirstUsed	=	core.uniqueByProperty(usage.FeatureFirstUsed,	'id');
	usage.CSSFirstUsed	=	core.uniqueByProperty(usage.CSSFirstUsed,	'id');

	//	Clear	the	array	before	doing	anything	else.
	core.clearReport();

	const	allFeaturesUsed	=	Object.entries([...usage.FeatureFirstUsed,	...usage.CSSFirstUsed].sort(core.sortByName));
	for	(const	[id,	feature]	of	allFeaturesUsed)	{
		const	caniuseName	=	BlinkFeatureNameToCaniuseName[feature.name];
		const	supported	=	core.supportedByGoogleSearch(caniuseName);
		if	(caniuseName	&&	!supported)	{
			const	url	=	'https://caniuse.com/#feat='	+	caniuseName;
			core.featureList(feature,	url);
		}	else	{
			core.featureList(feature);
		}
	}

	fs.unlinkSync(outfile);
	await	browser.close();

}
exports.start	=	start;
exports.engine	=	engine;
exports.core	=	core;
