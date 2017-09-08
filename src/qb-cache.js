/* Copyright 2017 Tristian Flanagan
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

'use strict';

/* Dependencies */
const fs = require('fs');
const join = require('path').join;
const merge = require('lodash.merge');
const debug = require('debug')('qbcache');
const RFC4122 = require('rfc4122');
const Promise = require('bluebird');

/* QBCache */
class QBCache {

	constructor(options) {
		this.settings = merge({}, QBCache.defaults, options || {});

		this.rfc4122 = new RFC4122();

		this._cache = {};

		return this;
	}

	clearCache(api, options){
		return new Promise((resolve, reject) => {
			if(!this.testAllowedAPI(api)){
				return resolve(false);
			}

			const key = this.getCacheKey(api, options);
			const path = join(this.settings.location, key);

			if(this._cache.hasOwnProperty(key)){
				try {
					delete this._cache[key];
				}catch(ignore){}
			}

			return unlinkAsync(path).then(() => {
				return false;
			}).then(resolve).catch(reject);
		});
	}

	getCacheKey(api, options){
		if(!options){
			options = {};
		}

		const parts = [
			api,
			options.dbid ? options.dbid : 'main'
		];

		switch(api){
			case 'API_DoQuery':
			case 'API_DoQueryCount':
				if(options.qid){
					parts.push(options.qid);
				}else
				if(options.query){
					parts.push(options.query);
				}

				if(options.clist){
					parts.push(options.clist);
				}

				if(options.slist){
					parts.push(options.slist);
				}

				if(options.options){
					parts.push(options.options);
				}
			break;
			case 'API_GetUserRole':
				parts.push(options.userid);
			break;
			case 'API_GetSchema':
				// Add Nothing
			break;
		}

		return this.rfc4122.v5(this.settings.namespace, parts.join('-')) + '.json';
	}

	load(api, options){
		return new Promise((resolve, reject) => {
			if(!this.testAllowedAPI(api)){
				return resolve(false);
			}

			const key = this.getCacheKey(api, options);
			const path = join(this.settings.location, key);

			if(this._cache.hasOwnProperty(key)){
				const cache = this._cache[key];

				if(!this.testCacheTimeout(cache)){
					delete this._cache[key];

					return unlinkAsync(path).then(() => {
						return false;
					}).then(resolve).catch(reject);
				}

				return resolve(merge({}, cache.data));
			}

			return fileToBuffer(path).then((buffer) => {
				const cache = JSON.parse(buffer.toString('utf8'));

				if(!this.testCacheTimeout(cache)){
					return unlinkAsync(path).then(() => {
						return false;
					}).then(resolve).catch(reject);
				}

				this._cache[key] = cache;

				return resolve(merge({}, cache.data));
			}).catch((err) => {
				if(err.code === 'ENOENT'){
					return resolve(false);
				}

				reject(err);
			});
		});
	}

	save(api, options, data, exp){
		return new Promise((resolve, reject) => {
			if(exp === undefined){
				exp = false;
			}

			const key = this.getCacheKey(api, options);
			const path = join(this.settings.location, key);
			const cache = {
				exp: exp === -1 ? exp : (Date.now() + (exp !== false ? exp : this.settings.dataTimeouts[api])),
				data: data
			};

			return writeFile(path, JSON.stringify(cache)).then(() => {
				this._cache[key] = cache;

				return true;
			}).then(resolve).catch(reject);
		});
	}

	testAllowedAPI(api){
		if(!this.settings.allowed.hasOwnProperty(api)){
			return false;
		}

		return this.settings.allowed[api];
	}

	testCacheTimeout(cache){
		return cache.exp === -1 || cache.exp >= Date.now();
	}

}

/* Helpers */
const writeFile = (path, data, options) => {
	return new Promise((resolve, reject) => {
		if(!options){
			options = {};
		}

		const stream = fs.createWriteStream(path);

		stream.on('error', (err) => {
			reject(err);
		});

		stream.on('close', () => {
			resolve();
		});

		if(options.fd){
			stream.write(data);

			stream.end();
		}else{
			stream.on('open', () => {
				stream.write(data);

				stream.end();
			});
		}
	});
};

const fileToBuffer = (path) => {
	return new Promise((resolve, reject) => {
		const stream = fs.createReadStream(path);
		const chunks = [];

		stream.on('error', (err) => {
			reject(err);
		});

		stream.on('data', (chunk) => {
			chunks.push(chunk);
		});

		stream.on('close', () => {
			resolve(Buffer.concat(chunks));
		});
	});
};

const unlinkAsync = (path) => {
	return new Promise((resolve, reject) => {
		fs.unlink(path, (err) => {
			if(err){
				if(err.code === 'ENOENT'){
					return resolve();
				}

				return reject(err);
			}

			resolve();
		});
	});
};

/* Expose Properties */
QBCache.defaults = {
	namespace: '79aa6464-6aaa-459c-8c76-8451761bad49',

	allowed: {
		// Not Supported: API_AddField: false,
		// Not Supported: API_AddGroupToRole: false,
		// Not Supported: API_AddRecord: false,
		// Not Supported: API_AddReplaceDBPage: false,
		// Not Supported: API_AddSubGroup: false,
		// Not Supported: API_AddUserToGroup: false,
		// Not Supported: API_AddUserToRole: false,
		// Not Supported: API_Authenticate: false,
		// Not Supported: API_ChangeGroupInfo: false,
		// Not Supported: API_ChangeManager: false,
		// Not Supported: API_ChangeRecordOwner: false,
		// Not Supported: API_ChangeUserRole: false,
		// Not Supported: API_CloneDatabase: false,
		// Not Supported: API_CopyGroup: false,
		// Not Supported: API_CopyMasterDetail: false,
		// Not Supported: API_CreateDatabase: false,
		// Not Supported: API_CreateGroup: false,
		// Not Supported: API_CreateTable: false,
		// Not Supported: API_DeleteDatabase: false,
		// Not Supported: API_DeleteField: false,
		// Not Supported: API_DeleteGroup: false,
		// Not Supported: API_DeleteRecord: false,
		API_DoQuery: false,
		API_DoQueryCount: false,
		// Not Supported: API_EditRecord: false
		// Not Supported: API_FieldAddChoices: false
		// Not Supported: API_FieldRemoveChoices: false
		// Not Supported: API_FindDBByName: false
		// Not Supported: API_GenAddRecordForm: false
		// Not Supported: API_GenResultsTable: false
		// Not Supported: API_GetAncestorInfo: false
		// Not Supported: API_GetAppDTMInfo: false
		// Not Supported: API_GetDBPage: false
		// Not Supported: API_GetDBInfo: false
		// Not Supported: API_GetDBVar: false
		// Not Supported: API_GetGroupRole: false
		// Not Supported: API_GetNumRecords: false
		API_GetSchema: true,
		// Not Supported: API_GetRecordAsHTML: false
		// Not Supported: API_GetRecordInfo: false
		// Not Supported: API_GetRoleInfo: false
		// Not Supported: API_GetUserInfo: false
		API_GetUserRole: true,
		// Not Supported: API_GetUsersInGroup: false
		// Not Supported: API_GrantedDBs: false
		// Not Supported: API_GrantedDBsForGroup: false
		// Not Supported: API_GrantedGroups: false
		// Not Supported: API_ImportFromCSV: false
		// Not Supported: API_ProvisionUser: false
		// Not Supported: API_PurgeRecords: false
		// Not Supported: API_RemoveGroupFromRole: false
		// Not Supported: API_RemoveSubgroup: false
		// Not Supported: API_RemoveUserFromGroup: false
		// Not Supported: API_RemoveUserFromRole: false
		// Not Supported: API_RenameApp: false
		// Not Supported: API_RunImport: false
		// Not Supported: API_SendInvitation: false
		// Not Supported: API_SetDBVar: false
		// Not Supported: API_SetFieldProperties: false
		// Not Supported: API_SetKeyField: false
		// Not Supported: API_SignOut: false
		// Not Supported: API_UploadFile: false
		// Not Supported: API_UserRoles: false
	},

	dataTimeouts: {
		API_DoQuery: 300,
		API_DoQueryCount: 300,
		API_GetSchema: 604800,
		API_GetUserRole: 604800
	},

	location: join(__dirname, '..', 'tmp')
};

/* Export Module */
if(typeof(module) !== 'undefined' && module.exports){
	module.exports = QBCache;
}else
if(typeof(define) === 'function' && define.amd){
	define('QBCache', [], function(){
		return QBCache;
	});
}
