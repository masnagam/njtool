// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

const moment = require('moment');
const puppeteer = require('puppeteer');

// istanbul ignore next
function collectIssues() {
  const issue_elements = document.querySelectorAll('#issue-list > li');
  return Array.from(issue_elements).map((issue_element) => {
    const url = issue_element.querySelector('a').href;
    const img = issue_element.querySelector('a > img').src;
    const date = issue_element.querySelector('a > h3 > span').innerText;
    const title = issue_element.querySelector('h3.h3') ?
          issue_element.querySelector('h3.h3').innerText : null;
    const id = parseInt(url.split('/').pop());
    return { id, url, img, date, title };
  });
}

class Volume {
  constructor(id) {
    const [name, volume] = id.split(':');
    if (name === undefined || volume === undefined) {
      throw new Error(`Invalid volume ID: ${id}`);
    }
    if (name != 'nature') {
      throw new Error(`Not supported at this mement: ${name}`);
    }

    this.name = name;
    this.volume = parseInt(volume);
    this.content = null;
  }

  static from(args) {
    if (!Array.isArray(args)) {
      args = [args];
    }
    return args.map((arg) => new Volume(arg));
  }

  get id() {
    return `${this.name}:${this.volume}`;
  }

  get url() {
    const base = 'https://www.nature.com';
    return `${base}/${this.name}/volumes/${this.volume}`;
  }

  get metadata() {
    let metadata = {
      name: this.name,
      volume: this.volume,
      url: this.url
    };
    if (this.content) {
      metadata.issues = this.content.issues
        .sort((a, b) => a.id - b.id)
        .map((issue) => {
          return {
            id: issue.id,
            url: issue.url,
            img: issue.img,
            date: moment(issue.date, 'D MMMM YYYY').format('YYYY-MM-DD'),
            title: issue.title,
            description: issue.description
          };
        });
    }
    if (this.error) {
      metadata.error = this.error;
    }
    return metadata;
  }

  async scrape(options) {
    let opt = {
      headless: options.headless
    };
    if (!options.sandbox) {
      opt.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }
    let browser = null;
    try {
      browser = await puppeteer.launch(opt);
      const page = await browser.newPage();
      await page.goto(this.url);
      const title = await page.title();
      if (title.startsWith('Page not found')) {
        throw new Error('Not found');
      }
      const issues = await page.evaluate(this._collectIssuesFunction);
      this.content = { issues };
    } catch (e) {
      this.error = e.message;
    }
    if (browser) {
      await browser.close();
    }
    return this.metadata;
  }

  get _collectIssuesFunction() {
    return collectIssues;
  }
}

module.exports = Volume;
