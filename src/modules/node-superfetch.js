/*
Internet Systems Consortium license

Copyright (c) 2017-2018, dragonfire535

https://github.com/dragonfire535/node-superfetch

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

  */
const fetch = require('node-fetch');
const FormData = require('form-data');
const { URL } = require('url');
const { METHODS } = require('http');
 
class Request {
	constructor(options) {
		if (!options.url) throw new Error('The "url" option is required.');
		this.url = new URL(options.url);
		this.method = options.method ? options.method.toUpperCase() : 'GET';
		if (!METHODS.includes(this.method)) throw new Error(`The method "${this.method}" is not supported.`);
		this.headers = options.headers || {};
		this.body = options.body || null;
		this.redirectCount = typeof options.redirects === 'undefined' ? 20 : options.redirects;
		this.agent = options.agent || null;
		this.noResultData = options.noResultData || false;
	}

	async _request() {
		const response = await fetch(this.url.toString(), {
			method: this.method,
			headers: this.headers,
			follow: this.redirectCount,
			body: this.body,
			agent: this.agent
		});
		let raw = null;
		if (!this.noResultData) raw = await response.buffer();
		const headers = {};
		for (const [header, value] of response.headers.entries()) headers[header] = value;
		const res = {
			status: response.status,
			statusText: response.statusText,
			headers,
			url: response.url,
			redirected: response.redirected,
			ok: response.ok,
			raw,
			get text() {
				if (this.noResultData) return null;
				return raw.toString();
			},
			get body() {
				if (this.noResultData) return null;
				if (/application\/json/gi.test(headers['content-type'])) {
					try {
						return JSON.parse(raw.toString());
					} catch (err) {
						return raw.toString();
					}
				} else {
					return raw;
				}
			}
		};
		if (!response.ok) {
			const err = new Error(`${res.status} ${res.statusText}`);
			Object.assign(err, res);
			throw err;
		}
		return res;
	}

	then(resolver, rejector) {
		return this._request().then(resolver, rejector);
	}

	catch(rejector) {
		return this.then(null, rejector);
	}

	end(cb) {
		return this.then(
			response => cb ? cb(null, response) : response,
			err => cb ? cb(err, err.status ? err : null) : err
		);
	}

	query(queryOrName, value) {
		if (typeof queryOrName === 'object') {
			for (const [param, val] of Object.entries(queryOrName)) this.url.searchParams.append(param, val);
		} else if (typeof queryOrName === 'string' && value) {
			this.url.searchParams.append(queryOrName, value);
		} else {
			throw new TypeError('The "query" parameter must be either an object or a query field.');
		}
		return this;
	}

	set(headersOrName, value) {
		if (typeof headersOrName === 'object') {
			for (const [header, val] of Object.entries(headersOrName)) this.headers[header] = val;
		} else if (typeof headersOrName === 'string' && value) {
			this.headers[headersOrName] = value;
		} else {
			throw new TypeError('The "headers" parameter must be either an object or a header field.');
		}
		return this;
	}

	attach(...args) {
		if (!this.body || !(this.body instanceof FormData)) this.body = new FormData();
		if (typeof args[0] === 'object') {
			for (const [key, val] of Object.entries(args[0])) this.attach(key, val);
		} else {
			this.body.append(...args);
		}
		this.set(this.body.getHeaders());
		this.set('content-length', this.body.getLengthSync());
		return this;
	}

	send(body, raw = false) {
		if (body instanceof FormData) raw = true;
		if (!raw && body !== null && typeof body === 'object') {
			const header = this.headers['content-type'];
			if (header) {
				if (/application\/json/gi.test(header)) body = JSON.stringify(body);
			} else {
				this.set('content-type', 'application/json');
				body = JSON.stringify(body);
			}
		}
		this.body = body;
		return this;
	}

	redirects(amount) {
		if (typeof amount !== 'number') throw new TypeError('The "amount" parameter must be a number.');
		this.redirectCount = amount;
		return this;
	}

	agent(agent) {
		this.agent = agent;
		return this;
	}
}

for (const method of METHODS) {
	if (!/^[A-Z$_]+$/gi.test(method)) continue;
	Request[method.toLowerCase()] = (url, options) => new Request({ url, method, ...options });
}

Request.version = "1.0.0";

module.exports = Request;
