// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

const chai = require('chai');
const sinon = require('sinon');
const path = require('path');
const proxyquire = require('proxyquire');

const expect = chai.expect;
chai.use(require('sinon-chai'));

// Classes below are used for making stubs
const { Browser } = require('puppeteer/lib/Browser');
const { Page } = require('puppeteer/lib/Page');

// Stubs
const stubs = {
  'fs': {
    existsSync: sinon.stub(),
    readFileSync: sinon.stub(),
    writeFileSync: sinon.stub(),
    unlinkSync: sinon.stub()
  },
  'mkdirp': {
    sync: sinon.stub()
  },
  'puppeteer': {
    launch: sinon.stub()
  },
  './sleep': sinon.stub()
};

const Downloader = proxyquire('../lib/downloader', stubs);

// TODO:
// * Testing scripts executed on the browser

describe('Downloader', () => {
  let options = null;
  let logger = null;
  let journals = null;
  let pageStub = null;
  let browserStub = null;

  beforeEach(() => {
    options = {
      username: 'username',
      password: 'password',
      outdir: 'outdir',
      retry: 4,
      retryInterval: 5,
      sleep: 0,
      headless: true,
      sandbox: true
    };

    logger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };

    journals = [
      { name: 'nature', volume: 1, issue: 2, date: '2018-04-01',
        articles: [
          { title: 'article 1', url: 'https://www.nature.com/articles/1.html' },
          { title: 'article 2', url: 'https://www.nature.com/articles/2.html' }
        ]
      }
    ];

    pageStub = sinon.createStubInstance(Page);
    pageStub.title.resolves('Volume 1 Issue 2, 1 April 2018');
    pageStub.url.returns('https://www.nature.com/');
    pageStub.evaluate.onCall(0)
      .resolves('https://www.nature.com/articles/1.pdf');
    pageStub.evaluate.onCall(1).resolves(
      `data:application/pdf;base64,${Buffer.from('1.pdf').toString('base64')}`);
    pageStub.evaluate.onCall(2)
      .resolves('https://www.nature.com/articles/2.pdf');
    pageStub.evaluate.onCall(3).resolves(
      `data:application/pdf;base64,${Buffer.from('2.pdf').toString('base64')}`);

    browserStub = sinon.createStubInstance(Browser);
    browserStub.newPage.resolves(pageStub);

    stubs.fs.existsSync.returns(false);
    stubs.puppeteer.launch.resolves(browserStub);
  });

  afterEach(() => {
    stubs.fs.existsSync.reset();
    stubs.fs.readFileSync.reset();
    stubs.fs.writeFileSync.reset();
    stubs.fs.unlinkSync.reset();
    stubs.mkdirp.sync.reset();
    stubs.puppeteer.launch.reset();
    stubs['./sleep'].reset();
  });

  describe('download', () => {
    it('should return 0', async () => {
      const downloader = new Downloader(options, logger);
      const status = await downloader.download(journals);
      expect(status).to.equal(0);
    });

    it('should create a folder', async () => {
      const downloader = new Downloader(options, logger);
      await downloader.download(journals);
      expect(stubs.mkdirp.sync)
        .to.have.been.calledWith(
          path.join(options.outdir, 'nature', '2018-04-01_1_2'));
    });

    it('should save pdf files', async () => {
      const downloader = new Downloader(options, logger);
      await downloader.download(journals);
      expect(stubs.fs.writeFileSync).to.have.been.calledWith(
        path.join(options.outdir, 'nature', '2018-04-01_1_2', '01 article 1.pdf'),
        Buffer.from('1.pdf'));
      expect(stubs.fs.writeFileSync).to.have.been.calledWith(
        path.join(options.outdir, 'nature', '2018-04-01_1_2', '02 article 2.pdf'),
        Buffer.from('2.pdf'));
    });

    it('should update the cursor file', async () => {
      const downloader = new Downloader(options, logger);
      await downloader.download(journals);
      expect(stubs.fs.writeFileSync).to.have.been.calledWith(
        path.join(options.outdir, 'nature', '2018-04-01_1_2', 'cursor'), '0');
      expect(stubs.fs.writeFileSync).to.have.been.calledWith(
        path.join(options.outdir, 'nature', '2018-04-01_1_2', 'cursor'), '1');
    });

    it('should remove the cursor file', async () => {
      const downloader = new Downloader(options, logger);
      await downloader.download(journals);
      expect(stubs.fs.unlinkSync).to.have.been.calledWith(
        path.join(options.outdir, 'nature', '2018-04-01_1_2', 'cursor'));
    });

    context('when --no-sandbox is specified', () => {
      beforeEach(() => {
        options.sandbox = false;
      });

      it('should call puppeteer.launch with the args option', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(stubs.puppeteer.launch).to.have.been.calledWith({
          headless: true,
          handleSIGINT: false,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      });
    });

    context('when puppeteer.launch throws an error', () => {
      beforeEach(() => {
        stubs.puppeteer.launch.throws();
      });

      it('should return 1', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(1);
      });

      it('should not call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.not.been.called;
      });
    });

    context('when browser.newPage throws an error', () => {
      beforeEach(() => {
        browserStub.newPage.throws();
      });

      it('should return 1', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(1);
      });

      it('should not call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.been.called;
      });
    });

    context('when page.goto to load the login page throws an error', () => {
      beforeEach(() => {
        pageStub.goto.withArgs('https://idp.nature.com/login/natureuser')
          .throws();
      });

      it('should return 1', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(1);
      });

      it('should not call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.been.called;
      });
    });

    context('when failed to login', () => {
      beforeEach(() => {
        pageStub.url.returns(
          'https://idp.nature.com/login/natureuser?error=concurrency_limit_reached');
      });

      it('should return 1', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(1);
      });

      it('should not call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.been.called;
      });

      it('should call logger.error', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(logger.error).to.have.been.called;
      });
    });

    context('when mkdirp.sync throws an error', () => {
      beforeEach(() => {
        stubs.mkdirp.sync.throws();
      });

      it('should return 1', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(1);
      });

      it('should not call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.been.called;
      });

      it('should call logger.error', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(logger.error).to.have.been.called;
      });
    });

    context('when a link to a PDF file has not been found', () => {
      beforeEach(() => {
        pageStub.evaluate.reset();
        pageStub.evaluate.resolves(null);
      });

      it('should return 0', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(0);
      });

      it('should call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.been.called;
      });

      it('should call logger.warn', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(logger.warn).to.have.been.calledTwice;
        for (let i = 0; i < 2; ++i) {
          expect(logger.warn.getCall(i).args[0])
            .to.include('No PDF file found');
        }
      });
    });

    context('when fetchOnBrowser throws an error', () => {
      beforeEach(() => {
        stubs['./sleep'].resolves();
        for (let i = 0; i < 5; ++i) {
          pageStub.evaluate.onCall(3 + i).rejects();
        }
      });

      it('should retry to download', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(logger.warn).to.have.callCount(4);
        for (let i = 0; i < 4; ++i) {
          expect(logger.warn.getCall(i).args[0])
            .to.include('Retry after 5s');
        }
        expect(logger.error).to.have.calledOnce;
        expect(logger.error.firstCall.args[0]).to.include('Failed');
      });

      it('should call sleep', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(stubs['./sleep']).to.have.callCount(4);
      });

      context('when the retryInterval is equal to 0', () => {
        beforeEach(() => {
          options.retryInterval = 0;
        });

        it('should not call sleep', async () => {
          const downloader = new Downloader(options, logger);
          await downloader.download(journals);
          expect(stubs['./sleep']).to.have.not.been.called;
        });
      });
    });

    context('when the sleep option value is larger than 0', () => {
      beforeEach(() => {
        options.sleep = 10;
      })

      it('should call sleep with the specified value', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(stubs['./sleep']).to.have.been.calledWith(options.sleep);
      });
    });

    context('when the cursor file exists', async () => {
      beforeEach(() => {
        stubs.fs.existsSync.withArgs(
          path.join(options.outdir, 'nature', '2018-04-01_1_2', 'cursor'))
          .returns(true);
        stubs.fs.readFileSync.returns('1');
      })

      it('should restart downloading', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(pageStub.goto).to.have.not.been.calledWith(
          'https://www.nature.com/articles/1.html');
        expect(pageStub.goto).to.have.been.calledWith(
          'https://www.nature.com/articles/2.html');
      });
    });

    context('when fetchOnBrowser has returned an invalid data URL', async () => {
      beforeEach(() => {
        options.retry = 0;
        pageStub.evaluate.onCall(1).resolves(`data:,text`);
      });

      it('should return 1', async () => {
        const downloader = new Downloader(options, logger);
        const status = await downloader.download(journals);
        expect(status).to.equal(1);
      });

      it('should logout from www.nature.com', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(pageStub.goto).to.have.been.calledWith(
          'https://idp.nature.com/logout/natureuser');
      });

      it('should call browser.close', async () => {
        const downloader = new Downloader(options, logger);
        await downloader.download(journals);
        expect(browserStub.close).to.have.been.called;
      });
    });
  });

  describe('abort', () => {
    it('should return 1', async() => {
      const downloader = new Downloader(options, logger);
      const promise = downloader.download(journals);
      downloader.abort();
      const status = await promise;
      expect(status).to.equal(1);
    });

    it('should call browser.close', async () => {
      const downloader = new Downloader(options, logger);
      const promise = downloader.download(journals);
      downloader.abort();
      await promise;
      expect(browserStub.close).to.have.been.called;
    });
  });
});
