// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

const moment = require('moment');
const path = require('path');
const puppeteer = require('puppeteer');

function collectArticles2017() {
  const article_elements = document.querySelectorAll('#content article');
  return Array.from(article_elements).map((article) => {
    const title = article.querySelector('a').innerText;
    const url = article.querySelector('a').href;
    return { title, url };
  });
}

function collectArticles2018() {
  const article_elements = document.querySelectorAll('article');
  return Array.from(article_elements).map((article) => {
    const title = article.querySelector('a').innerText;
    const type_element = article.querySelector('[data-test="article.type"]');
    const type = type_element ? type_element.innerText : null;
    const date_element = article.querySelector('time');
    const date = date_element ? date_element.dateTime : null;
    const url = article.querySelector('a').href;
    const desc_element = article.querySelector('[itemprop="description"] p');
    const description = desc_element ? desc_element.innerText : null;
    const author_elements =
      article.querySelectorAll('[data-test="author-list"] [itemprop="name"]');
    const authors = Array.from(author_elements).map((elem) => elem.innerText);
    return { title, type, date, description, authors, url };
  });
}

class Journal {
  constructor(id) {
    const [name, volume, issue] = id.split(':');
    if (name === undefined || volume === undefined || issue == undefined) {
      throw new Error(`Invalid journal ID: ${id}`);
    }
    if (name != 'nature') {
      throw new Error(`Not supported at this moment: ${name}`);
    }

    this.name = name;
    this.volume = volume;
    this.issue = issue;
    this.content = null;
  }

  static from(args) {
    if (!Array.isArray(args)) {
      args = [args];
    }
    return args.map((arg) => new Journal(arg));
  }

  get id() {
    return `${this.name}:${this.volume}:${this.issue}`;
  }

  get url() {
    const base = 'https://www.nature.com';
    if (this.volume < 553) {
      return `${base}/${this.name}/journal/v${this.volume}/n${this.issue}/index.html`;
    }
    return `${base}/${this.name}/volumes/${this.volume}/issues/${this.issue}`;
  }

  get metadata() {
    let metadata = {
      name: this.name,
      volume: this.volume,
      issue: this.issue,
      url: this.url
    };
    if (this.content) {
      metadata.date = this.content.date;
      metadata.articles = this.content.articles;
    }
    if (this.error) {
      metadata.error = this.error;
    }
    return metadata;
  }

  async scrape(options) {
    const browser = await puppeteer.launch({ headless: !options.showWindow });
    try {
      const page = await browser.newPage();
      await page.goto(this.url);
      const title = await page.title();
      if (title.startsWith('Page not found')) {
        throw new Error('Not found');
      }
      let date = this._getDateFromTitle(title);
      if (!date) {
        date = await this._getDateFromPage(page);
      }
      const articles = await page.evaluate(this._collectArticlesFunction);
      this.content = { date, articles };
    } catch (e) {
      this.error = e.message;
    } finally {
      await browser.close();
    }
    return this.metadata;
  }

  get _collectArticlesFunction() {
    if (this.volume < 553) {
      return collectArticles2017;
    }
    return collectArticles2018;
  }

  _getDateFromTitle(title) {
    const components = title.split(', ');
    if (components.length < 2) {
      return null;
    }
    return this._convertDate(components[1]);
  }

  async _getDateFromPage(page) {
    const date = await page.evaluate(() => {
      return document.querySelector('#issue-meta .more').innerText;
    });
    return this._convertDate(date);
  }

  _convertDate(date) {
    return moment(date, 'D MMMM YYYY').format('YYYY-MM-DD');
  }
}

module.exports = Journal;
