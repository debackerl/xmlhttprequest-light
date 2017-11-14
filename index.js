'use strict';

const http = require('http');
const https = require('https');
const urlParse = require('url').parse;
const util = require('util');

const keepAliveAgent = new http.Agent({ keepAlive: true });
const keepAliveAgentTLS = new https.Agent({ keepAlive: true });

const methods = {
	OPTIONS: 1,
	GET: 1,
	HEAD: 1,
	POST: 1,
	PUT: 1,
	DELETE: 1,
	CONNECT: -1,
	TRACE: -1,
	TRACK: -1
};

const charsets = {
	'UTF-8': 'utf8',
	'ISO-8859-1': 'latin1'
};

const charsetRe = /charset=([^()<>@,;:\"/[\]?.=\s]*)/i;

function getMimeType(contentType) {
	if(!contentType) return 'application/octet-stream';
	let i = contentType.indexOf(';');
	if(i !== -1) contentType = contentType.substr(0, i);
	return contentType.trim();
}

function getEncoding(contentType) {
	if(!contentType) return 'UTF-8';
	let match = charsetRe.exec(contentType);
	let charset = match ? match[1].toUpperCase() : 'UTF-8';
	return charsets[charset] || 'binary';
}

function TypeError() {}
function SyntaxError() {}
function SecurityError() {}
function InvalidAccessError() {}
function NotImplementedError() {}

function Event(type) {
	this.type = type;
}

function ProgressEvent(type, lengthComputable, loaded, total) {
	this.type = type;
	this.lengthComputable = lengthComputable;
	this.loaded = loaded;
	this.total = total;
}

util.inherits(ProgressEvent, Event);

function XMLHttpRequestUpload() {
	
}

function XMLHttpRequest() {
	this.timeout = 0;
	this.withCredentials = false;
	this.upload = new XMLHttpRequestUpload();
	
	this.readyState = this.UNSET;
	
	this.status = 0;
	this.statusText = "";
	this.responseURL = "";
	this.responseType = "";
	this.response = null;
	this.responseText = null;
	this.responseXML = null;
	
	this.onreadystatechange = null;
	this.onloadstart = null;
	this.onprogress = null;
	this.onabort = null;
	this.onerror = null;
	this.onload = null;
	this.ontimeout = null;
	this.onloadend = null;

	this._respheaders = null;
}

XMLHttpRequest.prototype.UNSET = 0;
XMLHttpRequest.prototype.OPENED = 1;
XMLHttpRequest.prototype.HEADERS_RECEIVED = 2;
XMLHttpRequest.prototype.LOADING = 3;
XMLHttpRequest.prototype.DONE = 4;

function changeReadyState(readyState) {
	this.readyState = readyState;
	if(this.onreadystatechange) this.onreadystatechange(new Event('readystatechange'));
}

function getProgressEvent(type) {
	return new ProgressEvent(type, this._respLength !== null, this._read, this._respLength);
}

XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
	if(arguments.length < 2) throw new TypeError();
	
	method = method.toUpperCase();
	let i = methods[method];
	if(!i) throw new SyntaxError();
	if(i < 0) throw new SecurityError();
	
	if(async === false) throw new NotImplementedError();
	
	if(url.startsWith('//')) url = 'http:' + url;
	
	this._method = method;
	this._url = urlParse(url);
	this._user = user;
	this._password = password;
	this._headers = {};
	this._mimeType = null;
	this._respheaders = {};
	this._respLength = null;
	
	changeReadyState.call(this, this.OPENED);
};

XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
	this._headers[header] = value;
};

XMLHttpRequest.prototype.overrideMimeType = function(mimetype) {
	this._mimeType = mimetype;
};

XMLHttpRequest.prototype.send = function(data) {
	if(this.readyState !== this.OPENED) throw new TypeError();
	
	if(data) {
		this._headers['Content-Length'] = data.length;
		if(!this._headers['Content-Type'])
			this._headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}
	
	const url = this._url;
	const tls = url.protocol === 'https:';

	let options = {
		agent: tls ? keepAliveAgentTLS : keepAliveAgent,
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port || (tls ? 443 : 80),
		method: this._method,
		path: url.path,
		headers: this._headers,
		timeout: this.timeout || 60
	};
	
	if(this._user) {
		options.auth = this._user;
		
		if(this._password)
			options.auth += ':' + this._password;
	}
	
	this._req = (tls ? https : http).request(options, (res) => {
		this.status = res.statusCode;
		this.statusText = res.statusMessage;
		
		this._respheaders = res.headers;
		
		changeReadyState.call(this, this.HEADERS_RECEIVED);
		changeReadyState.call(this, this.LOADING);
		
		this._respLength = Number.parseInt(res.headers['Content-Length']) || null;
		let contentType = res.headers['Content-Type'];
		let mimeType = this._mimeType || getMimeType(contentType);
		
		let buffers = [];
		this._read = 0;
		res.on('data', (data) => {
			buffers.push(data);
			this._read += data.length;
			
			if(this.onprogress) this.onprogress(getProgressEvent.call(this, 'progress'));
		});
		
		res.on('end', () => {
			if(this.readyState === this.LOADING) {
				let buffer = Buffer.concat(buffers);
				this._respLength = this._read;
				
				switch(this.responseType) {
					case 'arraybuffer':
						this.response = buffer;
						break;
					case 'blob':
						throw new NotImplementedError();
					case 'document':
						throw new NotImplementedError();
					case 'json':
						try {
							this.response = JSON.parse(buffer.toString('utf8'));
						} catch(e) {}
						break;
					default:
						this.responseText = this.response = buffer.toString(getEncoding(contentType));
						break;
				}
				
				changeReadyState.call(this, this.DONE);
				
				if(this.onload) this.onload(getProgressEvent.call(this, 'load'));
				if(this.onloadend) this.onloadend(getProgressEvent.call(this, 'loadend'));
				
				this._req = null;
			}
		});
	});
	
	if(this.onloadstart) this.onloadstart(getProgressEvent.call(this, 'loadstart'));
	
	this._req.on('abort', () => {
		if(this.onabort) this.onabort(getProgressEvent.call(this, 'abort'));
		if(this.onloadend) this.onloadend(getProgressEvent.call(this, 'loadend'));
		
		this._req = null;
	});
	
	this._req.on('aborted', () => {
		this.status = 0;
		this.statusText = "";
		this._respheaders = null;

		changeReadyState.call(this, this.DONE);
		
		if(this.onerror) this.onerror(getProgressEvent.call(this, 'error'));
		if(this.onloadend) this.onloadend(getProgressEvent.call(this, 'loadend'));
		
		this._req = null;
	});
	
	if(typeof(data) === 'string')
		data = Buffer.from(data, getEncoding(this._headers['Content-Type']));
	
	if(data)
		this._req.write(data);
	
	this._req.end();
};

XMLHttpRequest.prototype.abort = function() {
	if(this._req) {
		this.status = 0;
		this.statusText = "";
		this._respheaders = null;

		changeReadyState.call(this, this.DONE);
		
		this._req.abort();
	} else
		changeReadyState.call(this, this.UNSET);
};

XMLHttpRequest.prototype.getAllResponseHeaders = function() {
	if(!this._respheaders) return null;
	let txt = '';
	for(let key in this._respheaders) {
		if(txt.length) txt += '\r\n';
		txt += key + ': ' + this._respheaders[key];
	}
	return txt;
};

XMLHttpRequest.prototype.getResponseHeader = function(name) {
	return this._respheaders[name] || null;
};

module.exports = {
	TypeError,
	SyntaxError,
	SecurityError,
	InvalidAccessError,
	NotImplementedError,
	Event,
	ProgressEvent,
	XMLHttpRequest
};
