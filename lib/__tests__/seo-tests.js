const seoHelper = require('../index');
describe('Getters and Setters ', () => {

 it('Set and get a css feature', () => {
  expect.assertions(1);
  seoHelper.core.setCSS('test');
  return expect(seoHelper.core.getCss()).toEqual(['test']);
 });

 it('Set and get a A not supported feature', () => {
  expect.assertions(1);
  seoHelper.core.setNotSupported('test');
  return expect(seoHelper.core.getNotSupported()).toEqual(['test']);
 });

 it('Set and get a other feature', () => {
  expect.assertions(1);
  seoHelper.core.setOtherFeatures('test');
  return expect(seoHelper.core.getOtherFeatues()).toEqual(['test']);
 });
});

describe('Sorting Algorithms', () => {

});
