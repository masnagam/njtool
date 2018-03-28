// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

const chalk = require('chalk');
const fs = require('fs');
const fetch = require('node-fetch');
const mkdirp = require('mkdirp');
const moment = require('moment');
const path = require('path');
const promisePipe = require('promisepipe');
const puppeteer = require('puppeteer');
const sanitizeFilename = require('sanitize-filename');
const sleep = require('sleep');
const url = require('url');

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
  }

  async download(journals) {
    let opt = {
      headless: !this.options_.showWindow,
      handleSIGINT: false
    };
    if (this.options_.disableSandbox) {
      opt.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }
    const browser = await puppeteer.launch(opt);
    const ua = await browser.userAgent();
    const page = await browser.newPage();
    try {
      await this.login_(page);
      try {
        for (let journal of journals) {
          await this.download_(ua, page, journal);
        }
      } catch (e) {
        this.error_(e.message);
      } finally {
        await this.logout_(page);
      }
      this.info_('Done');
    } catch (e) {
      this.error_(e.message);
    } finally {
      await browser.close();
    }
    return this.aborted_ ? 1 : 0;
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
    if (url.parse(page.url()).hostname == 'idp.nature.com') {
      const error = url.parse(page.url(), true).query.error;
      let msg = `Failed to login: ${error}`
      if (error === 'concurrency_limit_reached') {
        msg = `${msg}: Retry after 30m`;
      }
      throw new Error(msg);
    }
  }

  async download_(ua, page, journal) {
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
        ua, page, journal.articles[i], dir, i + 1, total);
    }
    this.info_('Downloaded articles successfully');
    this.removeCursor_(dir);
  }

  async downloadArticleWithRetry_(ua, page, article, dir, count, total) {
    const maxTrial = 1 + this.options_.retry;
    for (let trial = 0; trial < maxTrial; ++trial) {
      const progress = new Progress(count, total, trial + 1, maxTrial);
      try {
        await this.downloadArticle_(ua, page, article, dir, progress);
        break;
      } catch (e) {
        if (trial < this.options_.retry) {
          const retryInterval = this.options_.retryInterval;
          this.warn_(`Retry after ${retryInterval}s: ${e.message}`, progress);
          sleep.sleep(retryInterval);
        } else {
          this.error_(`Failed: ${e.message}`, progress);
        }
      }
    }
  }

  async downloadArticle_(ua, page, article, dir, progress) {
    this.info_(`Loading ${article.url}...`, progress);
    await page.goto(article.url);

    this.info_(`Looking for a PDF file...`, progress);
    const pdfUrl = await page.evaluate(() => {
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
    });
    if (!pdfUrl) {
      this.warn_(`No PDF file found`, progress);
      return;
    }

    const sanitized = sanitizeFilename(article.title).trim();
    const pdfFile = `0${progress.count}`.substr(-2) + ` ${sanitized}.pdf`
    const pdfPath = path.join(dir, pdfFile);

    const cookies = await page.cookies(pdfUrl);
    const headers = {
      'Cookie': cookies.map((c) => `${c.name}="${c.value}"`).join(';'),
      'User-Agent': ua
    };

    this.info_(`Downloading ${pdfUrl}...`, progress);
    const res = await fetch(pdfUrl, {
      headers,
      timeout: this.options_.timeout * 1000
    });
    if (!res.ok) {
      throw new Error('Got an error response');
    }
    // The `timeout` value doesn't limit the response time of the streaming
    // response body.  For avoiding this issue, we use res.buffer().  See
    // body.js in the bitinn/node-fetch package for details.
    const buf = await res.buffer();

    this.info_(`Saving as ${pdfFile}...`, progress);
    fs.writeFileSync(pdfPath, buf);

    this.info_(`Sleep ${this.options_.sleep}s...`, progress);
    sleep.sleep(this.options_.sleep);
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
  }

  error_(msg, progress = null) {
    if (progress) {
      msg = `${progress.indicator}: ${msg}`;
    }
    this.logger_.error(chalk.red(`${moment().format()}: ${msg}`));
  }
}

module.exports = Downloader;
