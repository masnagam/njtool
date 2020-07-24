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
const { Browser } = require('puppeteer/lib/cjs/puppeteer/common/Browser');
const { Page } = require('puppeteer/lib/cjs/puppeteer/common/Page');

const Volume = proxyquire('../lib/volume', stubs);

// TODO:
// * Testing scripts executed on the browser

describe('Volume', () => {
  let pageStub = null;
  let browserStub = null;

  beforeEach(() => {
    pageStub = sinon.createStubInstance(Page);
    pageStub.title.returns('Volume 1');

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
    context('when called with a valid volume id', () => {
      it('should return an instance', () => {
        const volume = new Volume('nature:1');
        expect(volume.name).to.equal('nature');
        expect(volume.volume).to.equal(1);
        expect(volume.content).to.be.null;
      });
    });

    context('when called with an invalid volume id', () => {
      it('should throw an Error object', () => {
        expect(() => new Volume(1)).to.throw(Error);
        expect(() => new Volume('a')).to.throw(Error);
        expect(() => new Volume('a:b')).to.throw(Error);
        expect(() => new Volume('a:b:c')).to.throw(Error);
      });
    });
  });

  describe('from', () => {
    it('should return an array of Volume', () => {
      expect(Volume.from('nature:1')).to.be.an('array').of.length(1);
      expect(Volume.from(['nature:1', 'nature:2']))
        .to.be.an('array').of.length(2);
    });
  });

  describe('id', () => {
    it('should return a volume id', () => {
      const id = 'nature:1';
      const volume = new Volume(id);
      expect(volume).to.have.property('id', id);
    });
  });

  describe('url', () => {
    it('should return a URL', () => {
      const volume = new Volume('nature:1');
      expect(volume).to.have.property(
        'url', 'https://www.nature.com/nature/volumes/1');
    });
  });

  describe('metadata', () => {
    context('before scraping', () => {
      it('should have only basic data', () => {
        const volume = new Volume('nature:1');
        expect(volume.metadata).to.have.property('name', 'nature');
        expect(volume.metadata).to.have.property('volume', 1);
        expect(volume.metadata).to.have.property('url');
        expect(volume.metadata).to.not.have.property('issues');
        expect(volume.metadata).to.not.have.property('error');
      });
    });

    context('after scraping', () => {
      context('successfully', () => {
        it('should have basic data and issues', async () => {
          pageStub.evaluate.resolves([]);
          const volume = new Volume('nature:1');
          await volume.scrape({});
          expect(volume.metadata).to.have.property('name', 'nature');
          expect(volume.metadata).to.have.property('volume', 1);
          expect(volume.metadata).to.have.property('url');
          expect(volume.metadata).to.have.property('issues');
          expect(volume.metadata).to.not.have.property('error');
        });
      });

      context('unsuccessfully', () => {
        it('should have basic data and error', async () => {
          pageStub.evaluate.rejects();
          const volume = new Volume('nature:1');
          await volume.scrape({});
          expect(volume.metadata).to.have.property('name', 'nature');
          expect(volume.metadata).to.have.property('volume', 1);
          expect(volume.metadata).to.have.property('url');
          expect(volume.metadata).to.not.have.property('issues');
          expect(volume.metadata).to.have.property('error');
        });
      });
    });
  });

  describe('scrape', () => {
    beforeEach(() => {
      pageStub.evaluate.resolves([]);
    });

    it('should return metadata', async () => {
      const volume = new Volume('nature:1');
      const metadata = await volume.scrape({});
      expect(metadata).to.eql(volume.metadata);
    });

    it('should call puppeteer.launch with the headless option', async () => {
      const volume = new Volume('nature:1');
      await volume.scrape({
        headless: false,
        sandbox: false
      });
      expect(stubs.puppeteer.launch).to.have.been.calledWith({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    });

    context('when puppeteer.launch throws an error', () => {
      beforeEach(() => {
        stubs.puppeteer.launch.throws();
      });

      it('should return metadata with the error property', async () => {
        const volume = new Volume('nature:1');
        const metadata = await volume.scrape({});
        expect(metadata).to.have.property('error');
      });

      it('should not call browser.close', async() => {
        const volume = new Volume('nature:1');
        const metadata = await volume.scrape({});
        expect(browserStub.close).to.have.not.been.called;
      });
    });

    context('when browser.newPage throws an error', () => {
      it('should return metadata with the error property', async () => {
        browserStub.newPage.throws();
        const volume = new Volume('nature:1');
        const metadata = await volume.scrape({});
        expect(metadata).to.have.property('error');
      });

      it('should call browser.close', async() => {
        const volume = new Volume('nature:1');
        const metadata = await volume.scrape({});
        expect(browserStub.close).to.have.been.called;
      });
    });

    context('when 404 error page is loaded', () => {
      it('should return metadata with the error property', async () => {
        pageStub.title.returns('Page not found');
        const volume = new Volume('nature:1');
        const metadata = await volume.scrape({});
        expect(metadata).to.have.property('error');
      });

      it('should call browser.close', async() => {
        const volume = new Volume('nature:1');
        const metadata = await volume.scrape({});
        expect(browserStub.close).to.have.been.called;
      });
    });
  });
});
