/**
 * http://github.com/infosiftr/file-uploader
 *
 * (c) InfoSiftr
 * based on (c) Andrew Valums ( andrew(at)valums.com )
 *
 * requires jQuery (tested on 1.7)
 *
 * Licensed under GNU GPL 2 or later and GNU LGPL 2 or later, see license.txt.
 * (unfortunately; what a virus)
 */

var formatByteSize = formatByteSize || function(bytes) {
	var i = -1;
	do {
		bytes = bytes / 1024;
		i++;
	} while (bytes > 99);
	
	return Math.max(bytes, 0.1).toFixed(1) + ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'][i];
};

var qq = qq || {};

/**
 * Creates upload button, validates upload, but doesn't create file list or dd.
 */
qq.FileUploaderBasic = function(o) {
	this._options = {
		// set to true to see the server response
		debug: false,
		action: '/server/upload',
		params: {},
		button: null,
		multiple: true,
		maxConnections: 3,
		// validation
		allowedExtensions: [],
		sizeLimit: 0,
		minSizeLimit: 0,
		// events
		// return false to cancel submit
		onSubmit: function(id, fileName) {},
		onProgress: function(id, fileName, loaded, total) {},
		onComplete: function(id, fileName, responseJSON) {},
		onCancel: function(id, fileName) {},
		// messages
		messages: {
			typeError: ' {file} has invalid extension. Only {extensions} are allowed.',
			sizeError: ' {file} is too large, maximum file size is {sizeLimit}.',
			minSizeError: ' {file} is too small, minimum file size is {minSizeLimit}.',
			emptyError: ' {file} is empty, please select files again without it.',
			onLeave: 'The files are being uploaded, if you leave now the upload will be cancelled.'
		},
		showMessage: function(message) {
			alert(message);
		}
	};
	jQuery.extend(this._options, o);
	
	// number of files being uploaded
	this._filesInProgress = 0;
	this._handler = this._createUploadHandler();
	
	if (this._options.button) {
		this._options.button = jQuery(this._options.button);
		this._button = this._createUploadButton(this._options.button);
	}
	
	this._preventLeaveInProgress();
};

qq.FileUploaderBasic.prototype = {
	setParams: function(params) {
		this._options.params = params;
	},
	getInProgress: function() {
		return this._filesInProgress;
	},
	_createUploadButton: function(element) {
		var self = this;
		
		return new qq.UploadButton( {
			element: element,
			multiple: this._options.multiple && qq.UploadHandlerXhr.isSupported(),
			onChange: function(input) {
				self._onInputChange(input);
			}
		});
	},
	_createUploadHandler: function() {
		var self = this,
			handlerClass;
		
		if(qq.UploadHandlerXhr.isSupported()) {
			handlerClass = 'UploadHandlerXhr';
		}
		else {
			handlerClass = 'UploadHandlerForm';
		}
		
		var handler = new qq[handlerClass]( {
			debug: this._options.debug,
			action: this._options.action,
			maxConnections: this._options.maxConnections,
			onProgress: function(id, fileName, loaded, total) {
				self._onProgress(id, fileName, loaded, total);
				self._options.onProgress(id, fileName, loaded, total);
			},
			onComplete: function(id, fileName, result) {
				self._onComplete(id, fileName, result);
				self._options.onComplete(id, fileName, result);
			},
			onCancel: function(id, fileName) {
				self._onCancel(id, fileName);
				self._options.onCancel(id, fileName);
			}
		});
		
		return handler;
	},
	_preventLeaveInProgress: function() {
		var self = this;
		
		jQuery(window).on('beforeunload', function(e) {
			if (!self._filesInProgress) {
				return;
			}
			
			return self._options.messages.onLeave;
		});
	},
	_onSubmit: function(id, fileName) {
		this._filesInProgress++;
	},
	_onProgress: function(id, fileName, loaded, total) {
	},
	_onComplete: function(id, fileName, result) {
		this._filesInProgress--;
		if (result.error) {
			this._options.showMessage(result.error);
		}
	},
	_onCancel: function(id, fileName) {
		this._filesInProgress--;
	},
	_onInputChange: function(input) {
		if (this._handler instanceof qq.UploadHandlerXhr) {
			this._uploadFileList(input.prop('files'));
		}
		else {
			if (this._validateFile(input[0])) {
				this._uploadFile(input);
			}
		}
		this._button.reset();
	},
	_uploadFileList: function(files) {
		for (var i = 0; i < files.length; i++) {
			if ( !this._validateFile(files[i])) {
				return;
			}
		}
		
		for (var i = 0; i < files.length; i++) {
			this._uploadFile(files[i]);
		}
	},
	_uploadFile: function(fileContainer) {
		var id = this._handler.add(fileContainer);
		var fileName = this._handler.getName(id);
		
		if (this._options.onSubmit(id, fileName) !== false) {
			this._onSubmit(id, fileName);
			this._handler.upload(id, this._options.params);
		}
	},
	_validateFile: function(file) {
		var name, size;
		
		if (file.value) {
			// it is a file input
			// get input value and remove path to normalize
			name = file.value.replace(/.*(\/|\\)/, '');
		}
		else {
			// fix missing properties in Safari
			name = file.fileName != null ? file.fileName : file.name;
			size = file.fileSize != null ? file.fileSize : file.size;
		}
		
		if (!this._isAllowedExtension(name)) {
			this._error('typeError', name);
			return false;
		}
		else if (size === 0) {
			this._error('emptyError', name);
			return false;
		}
		else if (size && this._options.sizeLimit && size > this._options.sizeLimit) {
			this._error('sizeError', name);
			return false;
		}
		else if (size && size < this._options.minSizeLimit) {
			this._error('minSizeError', name);
			return false;
		}
		
		return true;
	},
	_error: function(code, fileName) {
		var message = this._options.messages[code];
		var r = function(name, replacement) {
			message = message.replace(name, replacement);
		}
		
		r(' {file}', this._formatFileName(fileName));
		r(' {extensions}', this._options.allowedExtensions.join(', '));
		r(' {sizeLimit}', this._formatSize(this._options.sizeLimit));
		r(' {minSizeLimit}', this._formatSize(this._options.minSizeLimit));
		
		this._options.showMessage(message);
	},
	_formatFileName: function(name) {
		if (name.length > 33) {
			name = name.slice(0, 19) + '...' + name.slice(-13);
		}
		return name;
	},
	_isAllowedExtension: function(fileName) {
		var ext = (-1 !== fileName.indexOf('.')) ? fileName.replace(/.*[.]/, '').toLowerCase() : '';
		var allowed = this._options.allowedExtensions;
		
		if (!allowed.length) {
			return true;
		}
		
		for (var i = 0; i < allowed.length; i++) {
			if (allowed[i].toLowerCase() === ext) {
				return true;
			}
		}
		
		return false;
	},
	_formatSize: formatByteSize
};

qq.UploadButton = function(o) {
	this._options = {
		element: null,
		// if set to true adds multiple attribute to file input
		multiple: false,
		// name attribute of file input
		name: 'file',
		onChange: function(input) {},
		hoverClass: 'qq-upload-button-hover',
		focusClass: 'qq-upload-button-focus'
	};
	
	jQuery.extend(this._options, o);
	
	this._element = jQuery(this._options.element);
	
	// make button suitable container for input
	this._element.css({
		position: 'relative',
		overflow: 'hidden',
		// Make sure browse button is in the right side
		// in Internet Explorer
		direction: 'ltr'
	});
	
	this._input = this._createInput();
};

qq.UploadButton.prototype = {
	/* returns file input element */
	getInput: function() {
		return this._input;
	},
	/* cleans/recreates the file input */
	reset: function() {
		this._input.remove();
		
		this._element.removeClass(this._options.focusClass);
		this._input = this._createInput();
	},
	_createInput: function() {
		var input = jQuery('<input>', {
			type: 'file',
			name: this._options.name
		});
		
		if (this._options.multiple) {
			input.attr('multiple', 'multiple');
		}
		
		input.css({
			position: 'absolute',
			// in Opera only 'browse' button
			// is clickable and it is located at
			// the right side of the input
			right: 0,
			top: 0,
			fontFamily: 'Arial',
			// 4 persons reported this, the max values that worked for them were 243, 236, 236, 118
			fontSize: '118px',
			margin: 0,
			padding: 0,
			cursor: 'pointer',
			opacity: 0
		});
		
		this._element.append(input);
		
		var self = this;
		input.on('change', function() {
			self._options.onChange(input);
		});
		
		input.on('mouseover', function() {
			self._element.addClass(self._options.hoverClass);
		});
		input.on('mouseout', function() {
			self._element.removeClass(self._options.hoverClass);
		});
		input.on('focus', function() {
			self._element.addClass(self._options.focusClass);
		});
		input.on('blur', function() {
			self._element.removeClass(self._options.focusClass);
		});
		
		// IE and Opera, unfortunately have 2 tab stops on file input
		// which is unacceptable in our case, disable keyboard access
		if (window.attachEvent) {
			// it is IE or Opera
			input.attr('tabIndex', '-1');
		}
		
		return input;
	}
};

/**
 * Class for uploading files, uploading itself is handled by child classes
 */
qq.UploadHandlerAbstract = function(o) {
	this._options = {
		debug: false,
		action: '/upload.php',
		// maximum number of concurrent uploads
		maxConnections: 999,
		onProgress: function(id, fileName, loaded, total) {},
		onComplete: function(id, fileName, response) {},
		onCancel: function(id, fileName) {}
	};
	jQuery.extend(this._options, o);
	
	this._queue = [];
	// params for files in queue
	this._params = [];
};
qq.UploadHandlerAbstract.prototype = {
	log: function(str) {
		if (this._options.debug && window.console && window.console.log) {
			console.log('[uploader] ' + str);
		}
	},
	/**
	 * Adds file or file input to the queue
	 * @returns id
	 **/
	add: function(file) {},
	/**
	 * Sends the file identified by id and additional query params to the server
	 */
	upload: function(id, params) {
		var len = this._queue.push(id);
		
		var copy = {};
		jQuery.extend(copy, params);
		this._params[id] = copy;
		
		// if too many active uploads, wait...
		if (len <= this._options.maxConnections) {
			this._upload(id, this._params[id]);
		}
	},
	/**
	 * Cancels file upload by id
	 */
	cancel: function(id) {
		this._cancel(id);
		this._dequeue(id);
	},
	/**
	 * Cancells all uploads
	 */
	cancelAll: function() {
		for (var i = 0; i < this._queue.length; i++) {
			this._cancel(this._queue[i]);
		}
		this._queue = [];
	},
	/**
	 * Returns name of the file identified by id
	 */
	getName: function(id) {},
	/**
	 * Returns size of the file identified by id
	 */
	getSize: function(id) {},
	/**
	 * Returns id of files being uploaded or
	 * waiting for their turn
	 */
	getQueue: function() {
		return this._queue;
	},
	/**
	 * Actual upload method
	 */
	_upload: function(id) {},
	/**
	 * Actual cancel method
	 */
	_cancel: function(id) {},
	/**
	 * Removes element from queue, starts upload of next
	 */
	_dequeue: function(id) {
		var i = jQuery.inArray(this._queue, id);
		this._queue.splice(i, 1);
		
		var max = this._options.maxConnections;
		
		if (this._queue.length >= max && i < max) {
			var nextId = this._queue[max-1];
			this._upload(nextId, this._params[nextId]);
		}
	}
};

/**
 * Class for uploading files using form and iframe
 * @inherits qq.UploadHandlerAbstract
 */
qq.UploadHandlerForm = function(o) {
	qq.UploadHandlerAbstract.apply(this, arguments);
	
	this._inputs = {};
};
// @inherits qq.UploadHandlerAbstract
jQuery.extend(qq.UploadHandlerForm.prototype, qq.UploadHandlerAbstract.prototype);

jQuery.extend(qq.UploadHandlerForm.prototype, {
	add: function(fileInput) {
		fileInput.attr('name', 'qqfile');
		var id = 'qq-upload-handler-iframe-' + Math.random() + '-' + Math.random();
		
		this._inputs[id] = fileInput;
		
		// remove file input from DOM
		fileInput.remove();
		
		return id;
	},
	getName: function(id) {
		// get input value and remove path to normalize
		if (this._inputs[id]) {
			return this._inputs[id][0].value.replace(/.*(\/|\\)/, '');
		}
		else {
			return '';
		}
	},
	_cancel: function(id) {
		this._options.onCancel(id, this.getName(id));
		
		delete this._inputs[id];
		
		var iframe = jQuery('#' + id);
		if (iframe.length) {
			// to cancel request set src to something else
			// we use src="javascript:false;" because it doesn't
			// trigger ie6 prompt on https
			iframe.attr('src', 'javascript:false');
			
			iframe.remove();
		}
	},
	_upload: function(id, params) {
		var input = this._inputs[id];
		
		if (!input) {
			throw new Error('file with passed id was not added, or already uploaded or cancelled');
		}
		
		var fileName = this.getName(id);
		
		var iframe = this._createIframe(id);
		var form = this._createForm(iframe, params);
		form.append(input);
		
		var self = this;
		this._attachLoadEvent(iframe, function() {
			self.log('iframe loaded');
			
			var response = self._getIframeContentJSON(iframe);
			
			self._options.onComplete(id, fileName, response);
			self._dequeue(id);
			
			delete self._inputs[id];
			// timeout added to fix busy state in FF3.6
			setTimeout(function() {
				iframe.remove();
			}, 1);
		});
		
		form.submit();
		form.remove();
		
		return id;
	},
	_attachLoadEvent: function(iframe, callback) {
		iframe.on('load', function() {
			// when we remove iframe from dom
			// the request stops, but in IE load
			// event fires
			if (!iframe.parent().length) {
				return;
			}
			
			// fixing Opera 10.53
			if (iframe[0].contentDocument &&
				iframe[0].contentDocument.body &&
				iframe[0].contentDocument.body.innerHTML === 'false') {
				// In Opera event is fired second time
				// when body.innerHTML changed from false
				// to server response approx. after 1 sec
				// when we upload file with iframe
				return;
			}
			
			callback();
		});
	},
	/**
	 * Returns json object received by iframe from server.
	 */
	_getIframeContentJSON: function(iframe) {
		// iframe.contentWindow.document - for IE<7
		var doc = iframe.contentDocument ? iframe.contentDocument: iframe.contentWindow.document,
			response;
		
		this.log("converting iframe's innerHTML to JSON");
		this.log('innerHTML = ' + doc.body.innerHTML);
		
		try {
			response = eval('(' + doc.body.innerHTML + ')');
		}
		catch(err) {
			response = {};
		}
		
		return response;
	},
	/**
	 * Creates iframe with unique name
	 */
	_createIframe: function(id) {
		var iframe = jQuery('<iframe>', {
			id: id,
			name: id
		}).hide();
		
		jQuery('body').append(iframe);
		
		return iframe;
	},
	/**
	 * Creates form, that will be submitted to iframe
	 */
	_createForm: function(iframe, params) {
		var queryString = this._options.action + '?' + jQuery.param(params);
		
		var form = jQuery('<form>', {
			method: 'post',
			enctype: 'multipart/form-data',
			action: queryString,
			target: iframe.attr('name')
		}).hide();
		
		jQuery('body').append(form);
		
		return form;
	}
});

/**
 * Class for uploading files using xhr
 * @inherits qq.UploadHandlerAbstract
 */
qq.UploadHandlerXhr = function(o) {
	qq.UploadHandlerAbstract.apply(this, arguments);
	
	this._files = [];
	this._xhrs = [];
	
	// current loaded size in bytes for each file
	this._loaded = [];
};

// static method
qq.UploadHandlerXhr.isSupported = function() {
	var input = document.createElement('input');
	input.type = 'file';
	
	return (
		'multiple' in input &&
		typeof File !== 'undefined' &&
		typeof (new XMLHttpRequest()).upload !== 'undefined'
	);
};

// @inherits qq.UploadHandlerAbstract
jQuery.extend(qq.UploadHandlerXhr.prototype, qq.UploadHandlerAbstract.prototype)

jQuery.extend(qq.UploadHandlerXhr.prototype, {
	/**
	 * Adds file to the queue
	 * Returns id to use with upload, cancel
	 **/
	add: function(file) {
		if (!(file instanceof File)) {
			throw new Error('Passed obj in not a File (in qq.UploadHandlerXhr)');
		}
		
		return this._files.push(file) - 1;
	},
	getName: function(id) {
		var file = this._files[id];
		// fix missing name in Safari 4
		return file.fileName != null ? file.fileName : file.name;
	},
	getSize: function(id) {
		var file = this._files[id];
		return file.fileSize != null ? file.fileSize : file.size;
	},
	/**
	 * Returns uploaded bytes for file identified by id
	 */
	getLoaded: function(id) {
		return this._loaded[id] || 0;
	},
	/**
	 * Sends the file identified by id and additional query params to the server
	 * @param {Object} params name-value string pairs
	 */
	_upload: function(id, params) {
		var file = this._files[id],
			name = this.getName(id),
			size = this.getSize(id);
		
		this._loaded[id] = 0;
		
		var xhr = this._xhrs[id] = new XMLHttpRequest();
		var self = this;
		
		xhr.upload.onprogress = function(e) {
			if (e.lengthComputable) {
				self._loaded[id] = e.loaded;
				self._options.onProgress(id, name, e.loaded, e.total);
			}
		};
		
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				self._onComplete(id, xhr);
			}
		};
		
		// build query string
		params = params || {};
		params['qqfile'] = name;
		var queryString = this._options.action + '?' + jQuery.param(params);
		
		xhr.open('POST', queryString, true);
		xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		xhr.setRequestHeader('X-File-Name', encodeURIComponent(name));
		xhr.setRequestHeader('Content-Type', 'application/octet-stream');
		xhr.send(file);
	},
	_onComplete: function(id, xhr) {
		// the request was aborted/cancelled
		if (!this._files[id]) {
			return;
		}
		
		var name = this.getName(id);
		var size = this.getSize(id);
		
		this._options.onProgress(id, name, size, size);
		
		if (xhr.status == 200) {
			this.log('xhr - server response received');
			this.log('responseText = ' + xhr.responseText);
			
			var response;
			
			try {
				response = eval('(' + xhr.responseText + ')');
			}
			catch(err) {
				response = {};
			}
			
			this._options.onComplete(id, name, response);
		}
		else {
			this._options.onComplete(id, name, {});
		}
		
		this._files[id] = null;
		this._xhrs[id] = null;
		this._dequeue(id);
	},
	_cancel: function(id) {
		this._options.onCancel(id, this.getName(id));
		
		this._files[id] = null;
		
		if (this._xhrs[id]) {
			this._xhrs[id].abort();
			this._xhrs[id] = null;
		}
	}
});
