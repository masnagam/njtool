# njtool - Tool for nature.com users

[![Version][npm-version]][npm-site]
[![Build Status][build-status]][build-site]
[![Windows Build Status][windows-build-status]][windows-build-site]
[![Dependency Status][dependency-status]][dependency-site]
[![Codacy Status][codacy-status]][codacy-site]
[![Maintainability Status][maintainability-status]][maintainability-site]
[![Coverage Status][coverage-status]][coverage-site]

`njtool` provides useful commands to operate on www.nature.com with [Puppeteer].

## USAGE

A command below fetches PDF files of articles in "Nature Volume 555 Issue 7694",
and saves them into /journals/nature/2018-03-01_555_7694:

```
$ njtool scrape nature:555:7694 | \
    njtool download -u your@email.address -p your_password -o /journals
```

Downloading multiple journals are supported:

```
$ njtool scrape nature:555:7695 nature:555:7696 | \
    njtool download -u your@email.address -p your_password -o /journals
```

At this moment, `njtool` supports only Nature.  I have no plan to support other
journals.  Because I have no plan to subscribe others.

`njtool` works fine on macOS.  It's recommended to use ``caffeinate`` in order
to prevent the system from sleeping when you run `njtool download` which
typically takes a long time.

`njtool` works fine on Linux, but you may need to run commands with the
`--disable-sandbox` option.  Probably, it also works on Windows, but I haven't
confirmed that yet.

See help for details of each command:

```
$ njtool help
```

## License

This software is distributed under the MIT license.  See [LICENSE] file for
details.

[npm-version]: https://img.shields.io/npm/v/njtool.svg
[npm-site]: https://www.npmjs.com/package/njtool
[build-status]: https://travis-ci.org/masnagam/njtool.svg?branch=master
[build-site]: https://travis-ci.org/masnagam/njtool
[windows-build-status]: https://ci.appveyor.com/api/projects/status/uwg3oqw5vw6eb5ge/branch/master?svg=true
[windows-build-site]: https://ci.appveyor.com/project/masnagam/njtool/branch/master
[dependency-status]: https://gemnasium.com/badges/github.com/masnagam/njtool.svg
[dependency-site]: https://gemnasium.com/github.com/masnagam/njtool
[codacy-status]: https://api.codacy.com/project/badge/Grade/84d4bc5c66524277aa6a13a43a6395ef
[codacy-site]: https://www.codacy.com/app/masnagam/njtool?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=masnagam/njtool&amp;utm_campaign=Badge_Grade
[maintainability-status]: https://api.codeclimate.com/v1/badges/520d222651cf6841a61d/maintainability
[maintainability-site]: https://codeclimate.com/github/masnagam/njtool/maintainability
[coverage-status]: https://api.codeclimate.com/v1/badges/520d222651cf6841a61d/test_coverage
[coverage-site]: https://codeclimate.com/github/masnagam/njtool/test_coverage
[Puppeteer]: https://github.com/GoogleChrome/puppeteer
[LICENSE]: ./LICENSE
