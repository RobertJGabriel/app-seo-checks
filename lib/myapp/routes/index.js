var	express	=	require('express');
var	router	=	express.Router();
const	seoHelper	=	require('../../index');

/*	GET	users	listing.	*/
router.get('/',	function	(req,	res,	next)	{
	const	getInfo	=	async	()	=>	{
		await	seoHelper.start(req.query.name);
		var	css	=	await	seoHelper.core.getCss();
		var	googleBot	=	await	seoHelper.core.getGoogleBot();

		const	jsonObject	=	{
			features:	{
				css:	css
			},
			googleBot:	{
				version:	googleBot
			},
			total:	{
				css:	css.length
			},
			links:	{
				details:	'https://developers.google.com/search/docs/guides/rendering.'
			}
		};

		res.json(jsonObject);
	};
	getInfo();
});

module.exports	=	router;
