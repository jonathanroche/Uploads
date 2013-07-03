

//function createFile(response) {
//	var result = {
//		Attributes: {
//				Archive: false, 
//				Hidden: false,
//				ReadOnly: false,
//				SymLink: false
//		}
//	};
//	
//	result.Location = "test.xsp";
//	result.Name 	= "test.xsp";
//	result.Length 	= 20; 
//	result.LocalTimeStamp = new Date().getTime();
//	result.Directory = false;
////	if (result.Directory) {
////		result.ChildrenLocation = result.Location;
////	}
//	return result;
//}


function _call(method, url, headers, body) {
	var d = new orion.Deferred(); // create a promise
	var xhr = new XMLHttpRequest();
	var header;
	
	try {
		xhr.open(method, url);
		if (headers !== null) {
			for (header in headers) {
				if (headers.hasOwnProperty(header)) {
					xhr.setRequestHeader(header, headers[header]);
				}
			}
		}
		xhr.send(body);
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				d.resolve({
					status: xhr.status,
					statusText: xhr.statusText,
					headers: xhr.getAllResponseHeaders(),
					responseText: xhr.responseText
				});
			}
		};
	} catch (e) {
		d.reject(e);
	}
	return d; // return the promise immediately
}

/** @namespace The global container for eclipse APIs. */
var eclipse = eclipse || {};

/**
 * An implementation of the file service that understands the Orion 
 * server file API. This implementation is suitable for invocation by a remote plugin.
 */

//var dominoloc = "http://mblout7.swg.usma.ibm.com/XAuth.nsf/xrest.xsp";


eclipse.XSPFileServiceImpl= (function() {
	/**
	 * @class Provides operations on files, folders, and projects.
	 * @name FileServiceImpl
	 */
	function XSPFileServiceImpl(location) {
		this._rootLocation = location;		
	}
	
	XSPFileServiceImpl.prototype = /**@lends eclipse.XSPFileServiceImpl.prototype */
	{
		_createParents: function(location) {
			var result = [];
			if (location.indexOf(this._rootLocation) === -1 || this._rootLocation === location) {
				return null;
			}
		
			var tail = location.substring(this._rootLocation.length);
			if (tail[tail.length - 1] === "/") {
				tail = tail.substring(0, tail.length - 1);
			}
			var segments = tail.split("/");
			segments.pop(); // pop off the current name
			
			var prefix = this._rootLocation;
			for (var i = 0; i < segments.length; ++i) {
				var parentName = segments[i];
				var parentPath = prefix + parentName + "/";
				prefix = parentPath;
				result.push({
					Name: parentName,
					Location: parentPath,
					ChildrenLocation: parentPath
				});
			}
			return result.reverse();
		},
		/**
		 * Obtains the children of a remote resource
		 * @param location The location of the item to obtain children for
		 * @return A deferred that will provide the array of child objects when complete
		 */
		fetchChildren: function(location) {
			if (!location) {
				location = this._rootLocation;
			}
//			return _call("PROPFIND", location, {depth:1}).then(function(response) {
//				if (response.status !== 207) {
//					throw "Error " + response.status;
//				}

			var regexp = new RegExp("^/file");
			var servletloc = location.replace(regexp, "/nsf");
			
//			var servletloc = dominoloc + location;			

			return _call("GET", servletloc, {depth:1}).then(function(response) {
				
				if (response.status !== 200) {
					throw "Error " + response.status;
				}
				var result = JSON.parse(response.responseText);
				var children = result.Children;
				return children;
			});
		},


		/**
		 * Loads all the user's workspaces. Returns a deferred that will provide the loaded
		 * workspaces when ready.
		 */
		loadWorkspaces: function() {
			var result = this.loadWorkspace(this._rootLocation);
			return [result]
		},
		
		/**
		 * Loads the workspace with the given id and sets it to be the current
		 * workspace for the IDE. The workspace is created if none already exists.
		 * @param {String} location the location of the workspace to load
		 * @param {Function} onLoad the function to invoke when the workspace is loaded
		 */
		loadWorkspace: function(location) {
			if (!location) {
				location = this._rootLocation;
			}
			var that = this; 
			//return _call("PROPFIND", location, {depth:1}).then(function(response) {
			//return _call("GET", "http://localhost/XAuth.nsf/xrest.xsp").then(function(response) {
			
			var regexp = new RegExp("^/file");
			var servletloc = location.replace(regexp, "/nsf");
			//var servletloc = dominoloc + location;
			
			//return _call("GET", "http://localhost:8080/nsf", {depth:1}).then(function(response) {
			return _call("GET", servletloc, {depth:1}).then(function(response) {
				
				if (response.status !== 200) {  // SPIDY ??
					throw "Error " + response.status;
				}
				
				var result = JSON.parse(response.responseText);
				
				// spidy - is this necessary, or possibly wiping something out?
				result.Parents = [];

				return result;
			});
		},

		/**
		 * Creates a new workspace with the given name. The resulting workspace is
		 * passed as a parameter to the provided onCreate function.
		 * @param {String} name The name of the new workspace
		 */
		_createWorkspace: function(name) {
			return this.createFolder(this._rootLocation, name);
		},
		
		/**
		 * Adds a project to a workspace.
		 * @param {String} url The workspace location
		 * @param {String} projectName the human-readable name of the project
		 * @param {String} serverPath The optional path of the project on the server.
		 * @param {Boolean} create If true, the project is created on the server file system if it doesn't already exist
		 */
		createProject: function(url, projectName, serverPath, create) {
			return this.createFolder(url, projectName);
		},
		/**
		 * Creates a folder.
		 * @param {String} parentLocation The location of the parent folder
		 * @param {String} folderName The name of the folder to create
		 * @return {Object} JSON representation of the created folder
		 */
		createFolder: function(parentLocation, folderName) {
			return _call("MKCOL", parentLocation + encodeURIComponent(folderName) + "/");
		},
		
		/**
		 * Create a new file in a specified location. Returns a deferred that will provide
		 * The new file object when ready.
		 * @param {String} parentLocation The location of the parent folder
		 * @param {String} fileName The name of the file to create
		 * @return {Object} A deferred that will provide the new file object
		 */
		createFile: function(parentLocation, fileName) {
			
			var regexp = new RegExp("^/file");
			var servletloc = parentLocation.replace(regexp, "/nsf") + encodeURIComponent(fileName);
			
			return _call("PUT", servletloc);
			
		},
		/**
		 * Deletes a file, directory, or project.
		 * @param {String} location The location of the file or directory to delete.
		 */
		deleteFile: function(location) {
			var regexp = new RegExp("^/file");
			var servletloc = location.replace(regexp, "/nsf");

			return _call("DELETE", servletloc);
		},
		
		/**
		 * Moves a file or directory.
		 * @param {String} sourceLocation The location of the file or directory to move.
		 * @param {String} targetLocation The location of the target folder.
		 * @param {String} [name] The name of the destination file or directory in the case of a rename
		 */
		moveFile: function(sourceLocation, targetLocation, name) {
			if (sourceLocation.indexOf(this._rootLocation) === -1 || targetLocation.indexOf(this._rootLocation) === -1) {
				throw "Not supported";	
			}
			
			var isDirectory = sourceLocation[sourceLocation.length -1] === "/";
			var target = targetLocation;
			
			if (target[target.length -1] !== "/") {
				target += "/";
			}
			
			if (name) {
				target += encodeURIComponent(name);
			} else {
				var temp = sourceLocation;
				if (isDirectory) {
					temp = temp.substring(0, temp.length - 1);
				}
				target += temp.substring(temp.lastIndexOf("/")+1);
			}
			
			if (isDirectory && target[target.length -1] !== "/") {
				target += "/";
			}
			return _call("MOVE", sourceLocation, {Destination: target});
		},
		 
		/**
		 * Copies a file or directory.
		 * @param {String} sourceLocation The location of the file or directory to copy.
		 * @param {String} targetLocation The location of the target folder.
		 * @param {String} [name] The name of the destination file or directory in the case of a rename
		 */
		copyFile: function(sourceLocation, targetLocation, name) {
			if (sourceLocation.indexOf(this._rootLocation) === -1 || targetLocation.indexOf(this._rootLocation) === -1) {
				throw "Not supported";	
			}
			
			var isDirectory = sourceLocation[sourceLocation.length -1] === "/";
			var target = targetLocation;
			
			if (target[target.length -1] !== "/") {
				target += "/";
			}
			
			if (name) {
				target += encodeURIComponent(name);
			} else {
				var temp = sourceLocation;
				if (isDirectory) {
					temp = temp.substring(0, temp.length - 1);
				}
				target += temp.substring(temp.lastIndexOf("/")+1);
			}
			
			if (isDirectory && target[target.length -1] !== "/") {
				target += "/";
			}
			return _call("COPY", sourceLocation, {Destination: target});
		},
		/**
		 * Returns the contents or metadata of the file at the given location.
		 *
		 * @param {String} location The location of the file to get contents for
		 * @param {Boolean} [isMetadata] If defined and true, returns the file metadata, 
		 *   otherwise file contents are returned
		 * @return A deferred that will be provided with the contents or metadata when available
		 */
		read: function(location, isMetadata) {
			
			// SPIDY took this from fileImpl, might bee a better example that loadWorkspace
			var that = this;
			
			var regexp = new RegExp("^/file");
			var servletloc = location.replace(regexp, "/nsf");
			
			//var servletloc = dominoloc + location;
			
			var url = new URL(servletloc, window.location);
			if (isMetadata) {
				url.query.set("parts", "meta");
			}
			
			return _call("GET", url.href, {depth:1}).then(function(response) {
				
				if (response.status !== 200) {
					throw "Error " + response.status;
				}
				
				if (isMetadata) {
					return response.responseText ? JSON.parse(response.responseText) : null;
				} else {
					return response.responseText; 
				}
			});
		},
		/**
		 * Writes the contents or metadata of the file at the given location.
		 *
		 * @param {String} location The location of the file to set contents for
		 * @param {String|Object} contents The content string, or metadata object to write
		 * @param {String|Object} args Additional arguments used during write operation (i.e. ETag) 
		 * @return A deferred for chaining events after the write completes with new metadata object
		 */		
		write: function(location, contents, args) {
			var headerData = {
					"Orion-Version": "1",
					"Content-Type": "text/plain;charset=UTF-8"
				};
			if (args && args.ETag) {
				headerData["If-Match"] = args.ETag;
			}
			
			var regexp = new RegExp("^/file");
			var servletloc = location.replace(regexp, "/nsf");
			
			//var servletloc = dominoloc + location;
			
			var url = new URL(servletloc, window.location);
			
			// if (typeof contents !== "string") { do we need to check for type. to see if we're saving metadata?
			
			return _call("PUT", url.href, headerData, contents);
		},
		/**
		 * Imports file and directory contents from another server
		 *
		 * @param {String} targetLocation The location of the folder to import into
		 * @param {Object} options An object specifying the import parameters
		 * @return A deferred for chaining events after the import completes
		 */		
		remoteImport: function(targetLocation, options) {
			throw "Not supported";
		},
		/**
		 * Exports file and directory contents to another server
		 *
		 * @param {String} sourceLocation The location of the folder to export from
		 * @param {Object} options An object specifying the export parameters
		 * @return A deferred for chaining events after the export completes
		 */		
		remoteExport: function(sourceLocation, options) {
			throw "Not supported";
		}
		
	};

	function _call2(method, url, headers, body) {
		var d = new orion.Deferred(); // create a promise
		var xhr = new XMLHttpRequest();
		try {
			xhr.open(method, url);
			if (headers) {
				Object.keys(headers).forEach(function(header){
					xhr.setRequestHeader(header, headers[header]);
				});
			}
			xhr.responseType = "arraybuffer";
			xhr.send(body);
			xhr.onload = function() {
				d.resolve({
					status: xhr.status,
					statusText: xhr.statusText,
					headers: xhr.getAllResponseHeaders(),
					response: xhr.response //builder.getBlob()
				});
			};
		} catch (e) {
			d.reject(e);
		}
		return d; // return the promise immediately
	}

	if (window.Blob) {
		XSPFileServiceImpl.prototype.readBlob = function(location) {
			return _call2("GET", location).then(function(result) {
				return result.response;
			});
		};

		XSPFileServiceImpl.prototype.writeBlob = function(location, contents, args) {
			var headerData = {};
			if (args && args.ETag) {
				headerData["If-Match"] = args.ETag;
			}
			return _call2("PUT", location, headerData, contents);
		};
	}
	return XSPFileServiceImpl;
}());
