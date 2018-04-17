var	express	=	require('express');
var	router	=	express.Router();
const	seoHelper	=	require('../../index');

/*	GET	users	listing.	*/
router.get('/',	function	(req,	res,	next)	{
	const	getInfo	=	async	()	=>	{
		await	seoHelper.start(req.query.name);
		var	css	=	await	seoHelper.core.getCss();
		var	others	=	await	seoHelper.core.getOtherFeatues();
		var	notSupported	=	await	seoHelper.core.getNotSupported();
		var	googleBot	=	await	seoHelper.core.getGoogleBot();
		var	otherFeatureLength	=	await	seoHelper.core.getOtherFeathersLength();
		var	cssFeatureLength	=	await	seoHelper.core.getNumberOfCSSFeatures();

		const	jsonObject	=	{
			features:	{
				css:	css,
				others:	others
			},
			noSupported:	notSupported,
			googleBot:	{
				version:	googleBot
			},
			total:	{
				htmlJavascript:	otherFeatureLength,
				css:	cssFeatureLength
			}

		};

		res.json(jsonObject);
	};
	getInfo();
});

module.exports	=	router;
