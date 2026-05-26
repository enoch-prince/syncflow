"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.compareVectorClocks = exports.SyncEngine = exports.LocalFirstDB = void 0;
exports.createDatabase = createDatabase;
var database_js_1 = require("./database.js");
Object.defineProperty(exports, "LocalFirstDB", { enumerable: true, get: function () { return database_js_1.LocalFirstDB; } });
var sync_engine_js_1 = require("./sync-engine.js");
Object.defineProperty(exports, "SyncEngine", { enumerable: true, get: function () { return sync_engine_js_1.SyncEngine; } });
var vector_clock_js_1 = require("./vector-clock.js");
Object.defineProperty(exports, "compareVectorClocks", { enumerable: true, get: function () { return vector_clock_js_1.compareVectorClocks; } });
var version_js_1 = require("./version.js");
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return version_js_1.VERSION; } });
async function createDatabase(options) {
    const { LocalFirstDB } = await Promise.resolve().then(() => __importStar(require('./database.js')));
    const { SyncEngine } = await Promise.resolve().then(() => __importStar(require('./sync-engine.js')));
    const db = new LocalFirstDB(options.name);
    try {
        const waModule = await Promise.resolve().then(() => __importStar(require('wa-sqlite')));
        await db.init(waModule);
    }
    catch (error) {
        console.warn('wa-sqlite not found, using mock storage');
        await db.init({});
    }
    let sync;
    if (options.serverUrl) {
        sync = new SyncEngine(db, {
            serverUrl: options.serverUrl,
        });
        if (options.syncInterval) {
            sync?.startContinuousSync(options.syncInterval);
        }
    }
    return { db, sync };
}
//# sourceMappingURL=index.js.map