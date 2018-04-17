const	fs	=	require('fs');
const	fetch	=	require('node-fetch');
const	chalk	=	require('chalk');
const	caniuseDB	=	require('caniuse-db/data.json').data;
const	outfile	=	'trace.json';
const	GOOGLE_SEARCH_CHROME_VERSION	=	41;
let	css	=	[];
let	otherFeatues	=	[];
let	notSupported	=	[];
let	numberOfOtherFeatures	=	0;
let	numberOfCSSFeatures	=	0;

/**
	*	Unique	items	based	on	obj	property.
	*	@param	{!Array}	items
	*	@param	{string}	propName	Property	name	to	filter	on.
	*	@return	{!Array}	unique	array	of	items
	*/
exports.uniqueByProperty	=	function	(items,	propName)	{
	const	posts	=	Array.from(
		items
			.reduce((map,	item)	=>	{
				return	map.set(item[propName],	item);
			},	new	Map())
			.values()
	);
	return	posts;
};

/**
	*	Sorts	array	of	features	by	their	name
	*	@param	{!Object}	a
	*	@param	{!Object}	b
	*/
exports.sortByName	=	function	(a,	b)	{
	if	(a.name	<	b.name)	{
		return	-1;
	}
	if	(a.name	>	b.name)	{
		return	1;
	}
	return	0;
};

/**
	*	Returns	true	if	`feature`	is	supported	by	the	Google	Search	bot.
	*	@param	{string}	feature	caniuse.com	feature	name/id.
	*	@return	{boolean}	True	if	the	feature	is	(likely)	supported	by	Google	Search.
	*/
exports.supportedByGoogleSearch	=	function	(feature)	{
	const	data	=	caniuseDB[feature];
	if	(!data)	{
		return	null;
	}
	const	support	=	data.stats.chrome[GOOGLE_SEARCH_CHROME_VERSION];
	return	support	===	'y';
};

/**
	*	Fetches	HTML/JS	feature	id/names	from	chromestatus.com.
	*	@param	{!Browser}	browser
	*	@return	{!Map<number,	string>}	key/val	pairs	of	ids	->	feature	name
	*/
async	function	fetchFeatureToNameMapping()	{
	const	resp	=	await	fetch('https://www.chromestatus.com/data/blink/features');
	return	new	Map(await	resp.json());
}
exports.fetchFeatureToNameMapping	=	fetchFeatureToNameMapping;

/**
	*	Fetches	CSS	property	id/names	from	chromestatus.com
	*	@param	{!Browser}	browser
	*	@return	{!Map<number,	string>}	key/val	pairs	of	ids	->	feature	name
	*/
async	function	fetchCSSFeatureToNameMapping(browser)	{
	const	resp	=	await	fetch('https://www.chromestatus.com/data/blink/cssprops');
	return	new	Map(await	resp.json());
}
exports.fetchCSSFeatureToNameMapping	=	fetchCSSFeatureToNameMapping;

/**
	*	Start	a	trace	during	load	to	capture	web	platform	features	used	by	the	page.
	*	@param	{!Browser}	browser
	*	@return	{!Object}
	*/
async	function	collectFeatureTraceEvents(browser,	url)	{
	const	page	=	await	browser.newPage();

	await	page.tracing.start({
		path:	outfile,
		categories:	[
			'-*',
			'disabled-by-default-devtools.timeline',	//	For	TracingStartedInPage
			'disabled-by-default-blink.feature_usage'
		]
	});

	await	page.goto(url,	{
		waitUntil:	'networkidle2'
	});
	console.log(`Waiting	for	page	to	be	idle...`);
	await	page.waitFor(5000);	//	Add	a	little	more	time	in	case	other	features	are	used.
	await	page.tracing.stop();

	console.log(`Trace	complete.`);

	const	trace	=	JSON.parse(fs.readFileSync(outfile,	{
		encoding:	'utf-8'
	}));

	//	Filter	out	all	trace	events	that	aren't	1.	blink	feature	usage
	//	and	2.	from	the	same	process/thread	id	as	our	test	page's	main	thread.
	const	traceStartEvent	=	trace.traceEvents.find(e	=>	e.name	===	'TracingStartedInPage');
	const	events	=	trace.traceEvents.filter(e	=>	{
		return	e.cat	===	'disabled-by-default-blink.feature_usage'	&&
			e.pid	===	traceStartEvent.pid	&&	e.tid	===	traceStartEvent.tid;
	});

	await	page.close();

	return	events;
}

exports.collectFeatureTraceEvents	=	collectFeatureTraceEvents;

/**
	*	@param	{!Object}	feature
	*/
function	featureList(feature,	url	=	null)	{
	const	suffix	=	url	?	`:	${url}`	:	'';
	let	object	=	{
		name:	feature.name,
		url:	suffix
	};
	if	(suffix	!==	'')	{
		setNotSupported(object);
	}	else	if	(feature.css)	{
		setCSS(object);
	}	else	if	(feature.css	===	false)	{
		setOtherFeatures(object);
	}	else	{
		setOtherFeatures(object);
	}
}

exports.featureList	=	featureList;

/**
	*	@param	{!Object}	feature
	*/
function	printResults(usage)	{
	setUsageHTMLLength(usage.FeatureFirstUsed.length);
	setUsageCSSLength(usage.CSSFirstUsed.length);
	console.log(`CAREFUL	using	${usage.FeatureFirstUsed.length}	HTML/JS,	${usage.CSSFirstUsed.length}	CSS	features.	Some	features	are	${chalk.underline('not')}	supported	by	the	Google	Search	crawler.`);
	console.log(`The	bot	runs	${'Chrome	'	+	GOOGLE_SEARCH_CHROME_VERSION},	which	may	not	render	your	page	correctly	when	it's	being	indexed.`);
	console.log('More	info	at	https://developers.google.com/search/docs/guides/rendering.');
}

exports.printResults	=	printResults;

/**
	*	Get	the	number	of	features	length
	*	@return	{!Array}	array	of	not	other	features
	*/
function	setUsageHTMLLength(numberOfHTMLJSFeatures)	{
	numberOfOtherFeatures	=	numberOfHTMLJSFeatures;
}
exports.setUsageHTMLLength	=	setUsageHTMLLength;

/**
	*	Set	an	item	in	the	array
	*	@return	None
	*/
function	getOtherFeathersLength()	{
	return	numberOfOtherFeatures;
}
exports.getOtherFeathersLength	=	getOtherFeathersLength;

/**
	*	Get	the	Google	Bot	Number
	*	@return	{!Array}	array	of	not	other	features
	*/
function	setUsageCSSLength(numberOfCSSFeaturesLength)	{
	numberOfCSSFeatures	=	numberOfCSSFeaturesLength;
}
exports.setUsageCSSLength	=	setUsageCSSLength;

/**
	*	Set	an	item	in	the	array
	*	@return	None
	*/
function	getNumberOfCSSFeatures()	{
	return	numberOfCSSFeatures;
}
exports.getNumberOfCSSFeatures	=	getNumberOfCSSFeatures;

/**
	*	Get	the	Google	Bot	Number
	*	@return	{!Array}	array	of	not	other	features
	*/
function	getGoogleBot()	{
	return	GOOGLE_SEARCH_CHROME_VERSION;
}
exports.getGoogleBot	=	getGoogleBot;

/**
	*	Set	an	item	in	the	array
	*	@return	None
	*/
function	setCSS(feature)	{
	css.push(feature);
}
exports.setCSS	=	setCSS;

/**
	*	Set	an	item	in	the	array
	*	@return	None
	*/
function	setOtherFeatures(feature)	{
	otherFeatues.push(feature);
}
exports.setOtherFeatures	=	setOtherFeatures;

/**
	*	Set	an	item	in	the	array
	*	@return	None
	*/
function	setNotSupported(feature)	{
	notSupported.push(feature);
}
exports.setNotSupported	=	setNotSupported;

/**
	*	Get	an	array	of	css	used	on	page
	*	@return	{!Array}	array	of	not	other	features
	*/
function	getCss()	{
	return	css;
}
exports.getCss	=	getCss;

/**
	*	Get	an	array	of	other	features	used	on	page
	*	@return	{!Array}	array	of	not	other	features
	*/
function	getOtherFeatues()	{
	return	otherFeatues;
}
exports.getOtherFeatues	=	getOtherFeatues;

/**
	*	Get	an	array	of	not	supported	features
	*	@return	{!Array}	array	of	not	supported	features
	*/
function	getNotSupported()	{
	return	notSupported;
}
exports.getNotSupported	=	getNotSupported;
