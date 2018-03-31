// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const expect = chai.expect;
chai.use(require('sinon-chai'));

// Stubs
const stubs = {
  puppeteer: {
    launch: sinon.stub()
  }
};

// Classes below are used for making stubs
const Browser = require('puppeteer/lib/Browser');
const Page = require('puppeteer/lib/Page');

const Journal = proxyquire('../lib/journal', stubs);

// TODO:
// * Testing scripts executed on the browser

describe('Journal', () => {
  let pageStub = null;
  let browserStub = null;

  beforeEach(() => {
    pageStub = sinon.createStubInstance(Page);
    pageStub.title.returns('Volume 1 Issue 2, 1 April 2018');

    browserStub = sinon.createStubInstance(Browser);
    browserStub.newPage.returns(pageStub);

    stubs.puppeteer.launch.returns(browserStub);
  });

  afterEach(() => {
    stubs.puppeteer.launch.reset();
    pageStub = null;
    browserStub = null;
  });

  describe('constructor', () => {
    context('when called with a valid journal id', () => {
      it('should return an instance', () => {
        const journal = new Journal('nature:1:2');
        expect(journal.name).to.equal('nature');
        expect(journal.volume).to.equal(1);
        expect(journal.issue).to.equal(2);
        expect(journal.content).to.be.null;
      });
    });

    context('when called with an invalid jounal id', () => {
      it('should throw an Error object', () => {
        expect(() => new Journal(1)).to.throw(Error);
        expect(() => new Journal('a')).to.throw(Error);
        expect(() => new Journal('a:b')).to.throw(Error);
        expect(() => new Journal('a:b:c')).to.throw(Error);
      });
    });
  });

  describe('from', () => {
    it('should return an array of Journal', () => {
      expect(Journal.from('nature:1:2')).to.be.an('array').of.length(1);
      expect(Journal.from(['nature:1:2', 'nature:1:3']))
        .to.be.an('array').of.length(2);
    });
  });

  describe('id', () => {
    it('should return a journal id', () => {
      const id = 'nature:1:2';
      const journal = new Journal(id);
      expect(journal).to.have.property('id', id);
    });
  });

  describe('url', () => {
    context('when the volume number is less than 553', () => {
      it('should return an old format URL', () => {
        const journal = new Journal('nature:552:111');
        expect(journal).to.have.property(
          'url', 'https://www.nature.com/nature/journal/v552/n111/index.html');
      });
    });

    context('when the volume number is equal to or greater than 553', () => {
      it('should return an old format URL', () => {
        const journal = new Journal('nature:553:111');
        expect(journal).to.have.property(
          'url', 'https://www.nature.com/nature/volumes/553/issues/111');
      });
    });
  });

  describe('metadata', () => {
    context('before scraping', () => {
      it('should have only basic data', () => {
        const journal = new Journal('nature:1:2');
        expect(journal.metadata).to.have.property('name', 'nature');
        expect(journal.metadata).to.have.property('volume', 1);
        expect(journal.metadata).to.have.property('issue', 2);
        expect(journal.metadata).to.have.property('url');
        expect(journal.metadata).to.not.have.property('date');
        expect(journal.metadata).to.not.have.property('articles');
        expect(journal.metadata).to.not.have.property('error');
      });
    });

    context('after scraping', () => {
      context('successfully', () => {
        it('should have basic data, date and articles', async () => {
          pageStub.evaluate.resolves([]);
          const journal = new Journal('nature:1:2');
          await journal.scrape({});
          expect(journal.metadata).to.have.property('name', 'nature');
          expect(journal.metadata).to.have.property('volume', 1);
          expect(journal.metadata).to.have.property('issue', 2);
          expect(journal.metadata).to.have.property('url');
          expect(journal.metadata).to.have.property('date');
          expect(journal.metadata).to.have.property('articles');
          expect(journal.metadata).to.not.have.property('error');
        });
      });

      context('unsuccessfully', () => {
        it('should have basic data and error', async () => {
          pageStub.evaluate.rejects();
          const journal = new Journal('nature:1:2');
          await journal.scrape({});
          expect(journal.metadata).to.have.property('name', 'nature');
          expect(journal.metadata).to.have.property('volume', 1);
          expect(journal.metadata).to.have.property('issue', 2);
          expect(journal.metadata).to.have.property('url');
          expect(journal.metadata).to.not.have.property('date');
          expect(journal.metadata).to.not.have.property('articles');
          expect(journal.metadata).to.have.property('error');
        });
      });
    });
  });

  describe('scrape', () => {
    beforeEach(() => {
      pageStub.evaluate.resolves([]);
    });

    it('should return metadata', async () => {
      const journal = new Journal('nature:1:2');
      const metadata = await journal.scrape({});
      expect(metadata).to.eql(journal.metadata);
    });

    it('should call puppeteer.launch with the headless option', async () => {
      const journal = new Journal('nature:1:2');
      await journal.scrape({
        showWindow: true,
        disableSandbox: true
      });
      expect(stubs.puppeteer.launch).to.have.been.calledWith({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    });

    context('when the volume number is less than 553', () => {
      it('should use collectArticles2017', async () => {
        const journal = new Journal('nature:552:111');
        await journal.scrape({});
        expect(pageStub.evaluate.firstCall.args[0])
          .to.a('function').that.has.property('name', 'collectArticles2017');
      });
    });

    context('when the volume number is equal to or greater than 553', () => {
      it('should use collectArticles2018', async () => {
        const journal = new Journal('nature:553:111');
        await journal.scrape({});
        expect(pageStub.evaluate.firstCall.args[0])
          .to.a('function').that.has.property('name', 'collectArticles2018');
      });
    });

    context('when puppeteer.launch throws an error', () => {
      beforeEach(() => {
        stubs.puppeteer.launch.throws();
      });

      it('should return metadata with the error property', async () => {
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(metadata).to.have.property('error');
      });

      it('should not call browser.close', async() => {
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(browserStub.close).to.have.not.been.called;
      });
    });

    context('when browser.newPage throws an error', () => {
      it('should return metadata with the error property', async () => {
        browserStub.newPage.throws();
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(metadata).to.have.property('error');
      });

      it('should call browser.close', async() => {
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(browserStub.close).to.have.been.called;
      });
    });

    context('when 404 error page is loaded', () => {
      it('should return metadata with the error property', async () => {
        pageStub.title.returns('Page not found');
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(metadata).to.have.property('error');
      });

      it('should call browser.close', async() => {
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(browserStub.close).to.have.been.called;
      });
    });

    context('when the title doesn not contain date', () => {
      beforeEach(() => {
        pageStub.title.returns('title');
        pageStub.evaluate.onFirstCall().returns('2 April 2018');
      });

      it('should call page.evaludate in order to extract date', async () => {
        const journal = new Journal('nature:1:2');
        const metadata = await journal.scrape({});
        expect(pageStub.evaluate).to.have.been.calledTwice;
        expect(metadata).to.have.property('date', '2018-04-02');
      });
    });
  });
});
