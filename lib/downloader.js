// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

const chalk = require('chalk');
const fs = require('fs');
const mkdirp = require('mkdirp');
const moment = require('moment');
const path = require('path');
const promisePipe = require('promisepipe');
const puppeteer = require('puppeteer');
const sanitizeFilename = require('sanitize-filename');
const { URL } = require('url');
const sleep = require('./sleep');

class Progress {
  constructor(count, total, trial, maxTrial) {
    this.count = count;
    this.total = total;
    this.trial = trial;
    this.maxTrial = maxTrial;
  }

  get indicator() {
    const progInd = [
      ` ${this.count}`.substr(-2),
      ` ${this.total}`.substr(-2)
    ].join('/');
    const trialInd = `${this.trial}/${this.maxTrial}`;
    return `${progInd}: ${trialInd}`;
  }
}

class Downloader {
  constructor(options, logger) {
    this.options_ = options;
    this.logger_ = logger;
    this.aborted_ = false;
    this.warnCount_ = 0;
    this.errorCount_ = 0;
  }

  async download(journals) {
    let opt = {
      headless: this.options_.headless,
      handleSIGINT: false
    };
    if (!this.options_.sandbox) {
      opt.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }
    let browser = null;
    try {
      browser = await puppeteer.launch(opt);
      const page = await browser.newPage();
      await this.login_(page);
      await this.downloadJournals_(page, journals);
      await this.logout_(page);
    } catch (e) {
      this.error_(e.message);
    }
    if (browser) {
      await browser.close();
    }
    this.info_(`Done: warns(${this.warnCount_}) errors(${this.errorCount_})`);
    return this.errorCount_ > 0 ? 1 : 0;
  }

  abort() {
    this.aborted_ = true;
  }

  async login_(page) {
    this.info_('Trying to login to www.nature.com...');
    await page.goto('https://idp.nature.com/login/natureuser');
    await page.type('#login-username', this.options_.username);
    await page.type('#login-password', this.options_.password);
    await page.click('#login-submit');
    await page.waitForNavigation();
    const url = new URL(page.url());
    if (url.hostname == 'idp.nature.com') {
      const error = url.searchParams.get('error');
      let msg = `Failed to login: ${error}`
      if (error === 'concurrency_limit_reached') {
        msg = `${msg}: Retry after 30m`;
      }
      throw new Error(msg);
    }
  }

  async downloadJournals_(page, journals) {
    try {
      for (let journal of journals) {
        await this.downloadJournal_(page, journal);
      }
    } catch (e) {
      this.error_(e.message);
    }
  }

  async downloadJournal_(page, journal) {
    const folder = `${journal.date}_${journal.volume}_${journal.issue}`;
    const dir = path.join(this.options_.outdir, journal.name, folder);
    this.info_(`mkdir -p ${dir}...`);
    mkdirp.sync(dir);
    const cursor = this.readCursor_(dir);
    const total = journal.articles.length;
    for (let i = cursor; i < total; ++i) {
      this.writeCursor_(dir, i);
      if (this.aborted_) {
        throw new Error('Aborted');
      }
      await this.downloadArticleWithRetry_(
        page, journal.articles[i], dir, i + 1, total);
    }
    this.removeCursor_(dir);
  }

  async downloadArticleWithRetry_(page, article, dir, count, total) {
    const maxTrial = 1 + this.options_.retry;
    for (let trial = 0; trial < maxTrial; ++trial) {
      const progress = new Progress(count, total, trial + 1, maxTrial);
      try {
        await this.downloadArticle_(page, article, dir, progress);
        break;
      } catch (e) {
        if (trial < this.options_.retry) {
          const retryInterval = this.options_.retryInterval;
          if (retryInterval > 0) {
            this.warn_(`Retry after ${retryInterval}s: ${e.message}`, progress);
            await sleep(retryInterval);
          } else {
            this.warn_(`Retry: ${e.message}`, progress);
          }
        } else {
          this.error_(`Failed: ${e.message}`, progress);
        }
      }
    }
  }

  async downloadArticle_(page, article, dir, progress) {
    this.info_(`Loading ${article.url}...`, progress);
    await page.goto(article.url);

    this.info_(`Looking for a PDF file...`, progress);
    const pdfUrl = await this.findPdfUrl_(page);
    if (!pdfUrl) {
      this.warn_(`No PDF file found`, progress);
      return;
    }

    const sanitized = sanitizeFilename(article.title).trim();
    const pdfFile = `0${progress.count}`.substr(-2) + ` ${sanitized}.pdf`
    const pdfPath = path.join(dir, pdfFile);

    this.info_(`Fetching ${pdfUrl}...`, progress);
    const buf = await this.fetch_(page, pdfUrl);

    this.info_(`Saving as ${pdfFile}...`, progress);
    fs.writeFileSync(pdfPath, buf);

    if (this.options_.sleep > 0) {
      this.info_(`Sleep ${this.options_.sleep}s...`, progress);
      await sleep(this.options_.sleep);
    }
  }

  async findPdfUrl_(page) {
    return await page.evaluate(findPdfUrlOnBrowser);
  }

  // NOTE:
  // At this moment, Puppeteer has no official methods to download data linked
  // from the current page.
  async fetch_(page, url) {
    const dataUrl = await page.evaluate(fetchOnBrowser, url);
    return this.parseDataUrl_(dataUrl);
  }

  parseDataUrl_(dataUrl) {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (matches === null) {
      throw new Error('Invalid data URL');
    }
    return Buffer.from(matches[2], 'base64');
  }

  async logout_(page) {
    this.info_('Logging out from www.nature.com...');
    await page.goto('https://idp.nature.com/logout/natureuser');
  }

  // Private methods below are used for improving the performance when
  // downloading a journal again after aborting to download the journal in some
  // reason.

  getCursorPath_(dir) {
    return path.join(dir, 'cursor');
  }

  readCursor_(dir) {
    const cursorPath = this.getCursorPath_(dir);
    if (!fs.existsSync(cursorPath)) {
      return 0;
    }
    return parseInt(fs.readFileSync(cursorPath, { encoding: 'utf8' }));
  }

  writeCursor_(dir, id) {
    const cursorPath = this.getCursorPath_(dir);
    fs.writeFileSync(cursorPath, String(id));
  }

  removeCursor_(dir) {
    const cursorPath = this.getCursorPath_(dir);
    fs.unlinkSync(cursorPath);
  }

  // Logging

  info_(msg, progress = null) {
    if (progress) {
      msg = `${progress.indicator}: ${msg}`;
    }
    this.logger_.info(`${moment().format()}: ${msg}`);
  }

  warn_(msg, progress = null) {
    if (progress) {
      msg = `${progress.indicator}: ${msg}`;
    }
    this.logger_.warn(chalk.yellow(`${moment().format()}: ${msg}`));
    this.warnCount_++;
  }

  error_(msg, progress = null) {
    if (progress) {
      msg = `${progress.indicator}: ${msg}`;
    }
    this.logger_.error(chalk.red(`${moment().format()}: ${msg}`));
    this.errorCount_++;
  }
}

// Scripts executed on the browser

// istanbul ignore next
function findPdfUrlOnBrowser() {
  let link = document.querySelector('[data-track="download"]');
  if (!link) {
    link = document.querySelector('[data-article-pdf]');
  }
  if (!link) {
    link = document.querySelector('li.download-pdf > a');
  }
  if (!link) {
    link = document.querySelector('a[type="application/pdf"]')
  }
  return link ? link.href : null;
}

// istanbul ignore next
async function fetchOnBrowser(url) {
  // Remove the scheme part from the url in order to avoid the mixed content
  // error.
  const fetchUrl = url.replace(/^\w+:/, '');
  const res = await fetch(fetchUrl, {
    method: 'GET',
    cache: 'no-cache',
    // Options below are needed for avoiding an authentication failure
    // before downloading.
    mode: 'cors',
    credentials: 'include'
  });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

// exports

module.exports = Downloader;
