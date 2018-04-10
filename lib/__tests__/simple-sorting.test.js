const simpleSorting = require('..');

let describe;
let it;
let expect;

describe('Url ', () => {
	it('Bubble Sort: 5 1 4 2 8', () => {
		const url = 'www.teamwork.com';
		expect.assertions(1);
		return expect(simpleSorting.start(url)).toEqual('www.teamwork.com');
	});
});
